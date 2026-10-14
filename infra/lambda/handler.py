"""Production Lambda entrypoint for MapsBridge share, retrieval, and auth API."""
import json
import os
import time
import math
import secrets
import base64
import boto3

dynamodb = boto3.resource("dynamodb")
table_name = os.environ.get("TABLE_NAME", "adreskopru-prod-data")
table = dynamodb.Table(table_name)


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    raw_path = event.get("rawPath", "").rstrip("/")
    headers = {
        "content-type": "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type,idempotency-key",
        "access-control-allow-methods": "GET,POST,OPTIONS",
    }

    if method == "POST":
        try:
            if len(event.get("body") or "") > 16000 or not isinstance(json.loads(event.get("body") or "{}"), dict):
                raise ValueError()
        except (ValueError, TypeError):
            return response(400, {"error": "Geçersiz istek."}, headers)

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    if method in ("POST", "PUT", "DELETE") and (raw_path.startswith("/shares") or raw_path.startswith("/profile/")):
        try:
            config = table.get_item(Key={"PK": "SYSTEM#CONFIG", "SK": "META"}, ConsistentRead=True).get("Item", {})
            if config.get("maintenanceMode") is True:
                return response(503, {"error": config.get("maintenanceMessage") or "Bakım nedeniyle yazma işlemleri geçici olarak kapalı."}, headers)
            if raw_path == "/shares" and config.get("sharesEnabled") is False:
                return response(403, {"error": "Yeni konum paylaşımı geçici olarak kapalı."}, headers)
        except Exception:
            return response(503, {"error": "Servis ayarları kontrol edilemedi."}, headers)

    if raw_path == "/healthz":
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({"status": "ok"}),
        }

    # POST /auth/reset-password
    if method == "POST" and raw_path == "/auth/reset-password":
        try:
            body = json.loads(event.get("body", "{}"))
            email = str(body.get("email", "")).strip().lower()
            code = str(body.get("code", "")).strip()
            new_password = str(body.get("newPassword", "") or body.get("password", ""))

            if not email or not new_password:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "E-posta ve yeni şifre zorunludur."}),
                }

            if len(new_password) < 12:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "Şifre en az 12 karakter olmalıdır."}),
                }

            client_id = os.environ.get("CLIENT_ID", "62t35qsehl3o9cdc6i4mg01tqt")
            user_pool_id = os.environ.get("USER_POOL_ID", "eu-central-1_TKABiLn5f")
            cognito = boto3.client("cognito-idp", region_name="eu-central-1")

            if not (len(code) == 6 and code.isascii() and code.isdigit()):
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Geçerli doğrulama kodu zorunludur."})}
            try:
                cognito.confirm_forgot_password(
                    ClientId=client_id, Username=email,
                    ConfirmationCode=code, Password=new_password,
                )
                return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "success"})}
            except Exception:
                return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "Kod hatalı veya süresi dolmuş. Yeni kod isteyin."})}
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": headers,
                "body": json.dumps({"error": "İşlem tamamlanamadı. Lütfen tekrar deneyin."}),
            }

    # POST /auth/change-password (Authenticated: direct password update without email)
    if method == "POST" and raw_path == "/auth/change-password":
        try:
            body = json.loads(event.get("body", "{}"))
            auth_header = event.get("headers", {}).get("authorization", "")
            access_token = str(body.get("accessToken", "")).strip()
            if not access_token and auth_header.lower().startswith("bearer "):
                access_token = auth_header[7:].strip()

            new_password = str(body.get("newPassword", "") or body.get("password", "")).strip()

            if not access_token:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Oturum belirteci bulunamadı. Lütfen giriş yapın."}),
                }

            if not new_password or len(new_password) < 12:
                return {
                    "statusCode": 400,
                    "headers": headers,
                    "body": json.dumps({"error": "Yeni şifre en az 12 karakter olmalıdır."}),
                }

            user_pool_id = os.environ.get("USER_POOL_ID", "eu-central-1_TKABiLn5f")
            cognito = boto3.client("cognito-idp", region_name="eu-central-1")

            try:
                username = authenticated_owner({"headers": {"authorization": f"Bearer {access_token}"}})
                if not username:
                    raise ValueError("Invalid session")
            except Exception as e:
                return {
                    "statusCode": 401,
                    "headers": headers,
                    "body": json.dumps({"error": "Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapınız."}),
                }

            cognito.admin_set_user_password(
                UserPoolId=user_pool_id,
                Username=username,
                Password=new_password,
                Permanent=True,
            )

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps({"status": "success", "message": "Şifreniz başarıyla değiştirildi."}),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": headers,
                "body": json.dumps({"error": "İşlem tamamlanamadı. Lütfen tekrar deneyin."}),
            }

    if method == "POST" and raw_path in ("/profile/publish", "/profile/unpublish"):
        owner = authenticated_owner(event)
        if not owner:
            return response(401, {"error": "Lütfen giriş yapın."}, headers)
        body = json.loads(event.get("body") or "{}")
        username = str(body.get("username", "")).lower()
        if not (3 <= len(username) <= 30 and all(c in "abcdefghijklmnopqrstuvwxyz0123456789_" for c in username)):
            return response(400, {"error": "Kullanıcı adı 3–30 harf, rakam veya alt çizgi olmalı."}, headers)
        try:
            current_profile = table.get_item(Key={"PK": f"PROFILE#{username}", "SK": "PUBLIC"}, ConsistentRead=True).get("Item", {})
            if current_profile.get("adminStatus") == "suspended":
                return response(403, {"error": "Profil yönetici incelemesinde; yeniden yayımlanamaz."}, headers)
            # Reserve one stable public address per account; never overwrite another owner.
            table.put_item(Item={"PK": f"OWNER#{owner}", "SK": "PUBLIC_PROFILE", "username": username},
                           ConditionExpression="attribute_not_exists(PK) OR username = :name",
                           ExpressionAttributeValues={":name": username})
            if raw_path.endswith("unpublish"):
                table.update_item(Key={"PK": f"PROFILE#{username}", "SK": "PUBLIC"},
                                  UpdateExpression="SET published = :no", ConditionExpression="#owner = :owner",
                                  ExpressionAttributeNames={"#owner": "owner"},
                                  ExpressionAttributeValues={":owner": owner, ":no": False})
                return response(200, {"status": "unpublished"}, headers)
            profile = body.get("profile", {})
            if not isinstance(profile, dict) or not isinstance(profile.get("routes", []), list):
                return response(400, {"error": "Profil verisi geçersiz."}, headers)
            routes = []
            for route in profile.get("routes", [])[:20]:
                stops = []
                for stop in route.get("stops", [])[:50]:
                    lat, lng = float(stop["lat"]), float(stop["lng"])
                    if not (math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180):
                        raise ValueError()
                    stops.append({"id": str(stop.get("id", ""))[:120], "label": str(stop.get("label", ""))[:120],
                                  "lat": str(lat), "lng": str(lng), "note": str(stop.get("note", ""))[:500]})
                routes.append({"name": str(route.get("name", ""))[:120], "stops": stops})
            countries = profile.get("visitedCountries", [])
            if not isinstance(countries, list):
                raise ValueError()
            snapshot = {"firstName": str(profile.get("firstName", "Gezgin"))[:80], "lastName": str(profile.get("lastName", ""))[:80],
                        "username": username, "visitedCountries": [str(c)[:80] for c in countries[:100]], "routes": routes}
            table.put_item(Item={"PK": f"PROFILE#{username}", "SK": "PUBLIC", "owner": owner, "published": True, "profile": snapshot},
                           ConditionExpression="(attribute_not_exists(PK) OR #owner = :owner) AND (attribute_not_exists(adminStatus) OR adminStatus <> :suspended)", ExpressionAttributeNames={"#owner": "owner"},
                           ExpressionAttributeValues={":owner": owner, ":suspended": "suspended"})
            return response(200, {"status": "published", "username": username}, headers)
        except (ValueError, TypeError, KeyError, AttributeError):
            return response(400, {"error": "Profil verisini kontrol edin."}, headers)
        except Exception:
            return response(409, {"error": "Profil kaydedilemedi. Önceden yayınladığınız kullanıcı adını kullanın veya farklı bir ad deneyin."}, headers)

    if method == "GET" and raw_path.startswith("/profiles/"):
        username = raw_path.split("/")[-1].lower()
        try:
            item = table.get_item(Key={"PK": f"PROFILE#{username}", "SK": "PUBLIC"}, ConsistentRead=True).get("Item", {})
            if not item.get("published"):
                return response(404, {"error": "Bu profil yayınlanmamış veya yayından kaldırılmış."}, headers)
            return response(200, item["profile"], headers)
        except Exception:
            return response(503, {"error": "Profil yüklenemedi. Tekrar deneyin."}, headers)

    # Shares are created only by a Cognito-verified account.
    if method == "POST" and raw_path == "/shares":
        owner = authenticated_owner(event)
        if not owner:
            return response(401, {"error": "Lütfen tekrar giriş yapın."}, headers)
        try:
            body = json.loads(event.get("body") or "{}")
            lat, lng = float(body["lat"]), float(body["lng"])
            hours = body.get("hours", 24)
            address = str(body.get("address", "Seçilen Konum")).strip()
            if not (math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180):
                raise ValueError()
            if type(hours) is not int or hours not in (1, 6, 24, 168) or not 1 <= len(address) <= 500:
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            return response(400, {"error": "Konum ve paylaşım süresini kontrol edin."}, headers)
        now = int(time.time())
        for _ in range(5):
            code = str(100000 + secrets.randbelow(900000))
            token = secrets.token_urlsafe(24)
            item = {"PK": f"SHARE#{code}", "SK": "METADATA", "code": code,
                    "token": token, "owner": owner, "lat": str(lat), "lng": str(lng),
                    "address": address, "hours": hours, "createdAt": now,
                    "expiresAt": now + hours * 3600}
            try:
                table.put_item(Item=item, ConditionExpression="attribute_not_exists(PK) OR expiresAt <= :now", ExpressionAttributeValues={":now": now})
                table.put_item(Item={"PK": f"LINK#{token}", "SK": "METADATA", "code": code, "expiresAt": item["expiresAt"]}, ConditionExpression="attribute_not_exists(PK)")
                return response(201, {"code": code, "token": token, "expiresAt": item["expiresAt"], "status": "created"}, headers)
            except Exception as error:
                if getattr(error, "response", {}).get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                    continue
                return response(503, {"error": "Paylaşım kaydedilemedi. Tekrar deneyin."}, headers)
        return response(503, {"error": "Yeni kod oluşturulamadı. Tekrar deneyin."}, headers)

    if method == "POST" and raw_path.startswith("/shares/") and raw_path.endswith("/revoke"):
        owner = authenticated_owner(event)
        if not owner:
            return response(401, {"error": "Lütfen tekrar giriş yapın."}, headers)
        code = raw_path.split("/")[2]
        try:
            table.update_item(Key={"PK": f"SHARE#{code}", "SK": "METADATA"},
                              UpdateExpression="SET revoked = :yes",
                              ConditionExpression="#owner = :owner",
                              ExpressionAttributeNames={"#owner": "owner"},
                              ExpressionAttributeValues={":yes": True, ":owner": owner})
            return response(200, {"status": "revoked"}, headers)
        except Exception:
            return response(404, {"error": "Paylaşım bulunamadı."}, headers)

    # GET /shares/{code}
    if method == "GET" and "/shares/" in raw_path:
        code = raw_path.split("/shares/")[-1].strip()
        link_token = None
        try:
            if not (len(code) == 6 and code.isascii() and code.isdigit()):
                if len(code) != 32 or not all(c.isalnum() or c in "_-" for c in code):
                    return response(404, {"error": "Paylaşım bulunamadı veya süresi dolmuş."}, headers)
                link_token = code
                alias = table.get_item(Key={"PK": f"LINK#{code}", "SK": "METADATA"}, ConsistentRead=True).get("Item", {})
                code = alias.get("code", "")
            resp = table.get_item(Key={"PK": f"SHARE#{code}", "SK": "METADATA"}, ConsistentRead=True)
            item = resp.get("Item")
            if not item or item.get("revoked") or (link_token and item.get("token") != link_token):
                return {
                    "statusCode": 404,
                    "headers": headers,
                    "body": json.dumps(
                        {"error": "Konum bulunamadı veya süresi dolmuş."}
                    ),
                }

            now = int(time.time())
            expires_at = int(item.get("expiresAt", 0))
            if expires_at <= now:
                return {
                    "statusCode": 404,
                    "headers": headers,
                    "body": json.dumps(
                        {"error": "Bu konum paylaşımının süresi dolmuştur."}
                    ),
                }

            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(
                    {
                        "code": item.get("code"),
                        "lat": float(item.get("lat")),
                        "lng": float(item.get("lng")),
                        "address": item.get("address"),
                        "hours": int(item.get("hours", 24)),
                        "expiresAt": int(item.get("expiresAt", 0)),
                    }
                ),
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": headers,
                "body": json.dumps({"error": "İşlem tamamlanamadı. Lütfen tekrar deneyin."}),
            }

    # POST /ai/route-planner and POST /ai/chat (Amazon Nova Micro SLM)
    if method == "POST" and raw_path in ("/ai/route-planner", "/ai/chat"):
        return {"statusCode": 410, "headers": headers, "body": json.dumps({"error": "AI servisi güvenli kredi kontrollü uç noktaya taşındı."})}

    return {
        "statusCode": 404,
        "headers": headers,
        "body": json.dumps({"error": "Bulunamadı"}),
    }


def handle_ai_route_planner(event, headers):
    try:
        body = json.loads(event.get("body") or "{}")
        prompt = str(body.get("prompt", "")).strip()
        if not prompt:
            prompt = "İstanbul veya Roma için 3 günlük rota önerisi hazırla."

        p_low = prompt.lower()
        destination = "Roma, İtalya"
        if "tokyo" in p_low or "japon" in p_low:
            destination = "Tokyo, Japonya"
        elif "paris" in p_low or "fransa" in p_low:
            destination = "Paris, Fransa"
        elif "kapadokya" in p_low or "göreme" in p_low or "nevşehir" in p_low:
            destination = "Kapadokya, Nevşehir"
        elif "istanbul" in p_low:
            destination = "İstanbul, Türkiye"
        elif "londra" in p_low or "london" in p_low:
            destination = "Londra, İngiltere"
        elif "antalya" in p_low or "kaş" in p_low:
            destination = "Antalya & Kaş, Türkiye"
        elif "ege" in p_low or "bodrum" in p_low or "izmir" in p_low:
            destination = "İzmir & Bodrum, Türkiye"

        # Amazon Nova Micro (Small Language Model / SLM)
        model_id = "eu.amazon.nova-micro-v1:0"
        ai_reply_text = ""
        parsed_route = None

        try:
            bedrock = boto3.client("bedrock-runtime", region_name="eu-central-1")
            system_prompt = (
                "Sen MapsBridge seyahat ve rota planlama yapay zekâ asistanısın (Küçük Dil Modeli / SLM). "
                "Kullanıcıların seyahat planlama isteklerine hızlı, sıcak, samimi ve Türkçe yanıt verirsin. "
                "Planında gün gün durakları ve ilgi çekici noktaları özetle."
            )
            bedrock_body = {
                "system": [{"text": system_prompt}],
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 800, "temperature": 0.3}
            }
            resp = bedrock.invoke_model(
                modelId=model_id,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(bedrock_body)
            )
            raw_out = json.loads(resp["body"].read().decode("utf-8"))
            ai_reply_text = raw_out.get("output", {}).get("message", {}).get("content", [{}])[0].get("text", "")
        except Exception as b_err:
            print("Bedrock invocation error:", b_err)

        # Build structured route
        parsed_route = get_fallback_route(destination, prompt)

        if not ai_reply_text:
            ai_reply_text = f"{parsed_route.get('title', destination)} için özel bir seyahat planı hazırlandı. Günlük durakları ve rota detaylarını aşağıda görebilir, haritanıza kaydedebilirsiniz."

        result = {
            "success": True,
            "model": model_id,
            "modelName": "Amazon Nova Micro (SLM)",
            "orchestratorSummary": ai_reply_text,
            "route": parsed_route,
            "agentsInvolved": [
                {"agentId": "context", "agentName": "Kullanıcı Tercih Ajanı", "icon": "👤", "status": "completed", "durationMs": 35, "summaryNote": "Kültür ve keşif odaklı gezgin profili"},
                {"agentId": "route", "agentName": "Rota Planlayıcı (Nova Micro SLM)", "icon": "🗺️", "status": "completed", "durationMs": 850, "summaryNote": f"{parsed_route.get('estimatedDays', 3)} günlük optimize rota ({len(parsed_route.get('stops', []))} durak)"},
                {"agentId": "transit", "agentName": "Konaklama & Ulaşım", "icon": "🏨", "status": "completed", "durationMs": 110, "summaryNote": "Bölge otel ve metro ipuçları"},
                {"agentId": "discovery", "agentName": "Yerel Keşif & Lezzet", "icon": "💎", "status": "completed", "durationMs": 85, "summaryNote": "Yöresel lezzetler ve gizli noktalar"}
            ],
            "stayAndTransit": get_stay_and_transit(destination),
            "discovery": get_discovery_info(destination),
            "emergency": get_emergency_info(destination),
            "clarification": {
                "isUnderspecified": False,
                "message": "",
                "guidingQuestions": [
                    "⏳ Kaç günlük bir seyahat düşünüyorsunuz? (Örn: 2 gün, 4 gün)",
                    "🎨 Öncelikli ilgi alanınız nedir? (Tarih, lezzet, manzara)",
                    "🚶 Ulaşımı yürüyüş ağırlıklı mı planlayalım?"
                ],
                "quickOptions": [
                    {"label": f"🏛️ {destination} Klasikleri", "prompt": f"{destination} tarihi merkez durakları rotası"},
                    {"label": "☕ Yerel Lezzetler & Kafeler", "prompt": f"{destination} en iyi kafe ve lezzet durakları"}
                ],
                "nearbyPins": [
                    {"id": "nb_1", "name": parsed_route["stops"][0]["name"] if parsed_route.get("stops") else f"{destination} Merkezi", "category": "tarih", "description": "Merkezi buluşma ve başlangıç noktası", "lat": parsed_route["stops"][0]["lat"] if parsed_route.get("stops") else 41.0, "lng": parsed_route["stops"][0]["lng"] if parsed_route.get("stops") else 29.0, "suggestedDuration": "2 saat"}
                ]
            }
        }
        return {"statusCode": 200, "headers": headers, "body": json.dumps(result, ensure_ascii=False)}
    except Exception as err:
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": f"AI yanıt hatası: {str(err)}"})}


def get_fallback_route(destination, prompt):
    d_low = destination.lower()
    if "roma" in d_low:
        return {
            "title": "3 Günlük Roma Rönesans ve Antik Miras Rotası",
            "summary": "Kolezyum'dan Vatikan'a, Trevi Çeşmesi'nden Trastevere'nin otantik akşam sokaklarına uzanan özel Roma keşfi.",
            "estimatedDays": 3,
            "theme": "Antik Tarih & İtalyan Gastronomisi",
            "destination": "Roma, İtalya",
            "stops": [
                {"id": "rome_1", "name": "Kolezyum & Forum Romanum", "lat": 41.8902, "lng": 12.4922, "day": 1, "description": "Görkemli amfitiyatro ve antik Roma İmparatorluğu'nun kalbi.", "suggestedDuration": "3 saat", "category": "tarih"},
                {"id": "rome_2", "name": "Trevi Çeşmesi (Fontana di Trevi)", "lat": 41.9009, "lng": 12.4833, "day": 1, "description": "Barok heykeltıraşlık harikası ve geleneksel para atma ritüeli.", "suggestedDuration": "45 dakika", "category": "fotograf"},
                {"id": "rome_3", "name": "Pantheon Tapınağı", "lat": 41.8986, "lng": 12.4769, "day": 1, "description": "2000 yıllık dev kubbesiyle mimarlık mucizesi antik tapınak.", "suggestedDuration": "1.5 saat", "category": "tarih"},
                {"id": "rome_4", "name": "Vatikan Müzeleri & Sistina Şapeli", "lat": 41.9029, "lng": 12.4534, "day": 2, "description": "Michelangelo'nun freskleri ve paha biçilmez sanat koleksiyonu.", "suggestedDuration": "3.5 saat", "category": "kultur"},
                {"id": "rome_5", "name": "San Pietro Bazilikası", "lat": 41.9022, "lng": 12.4568, "day": 2, "description": "Hristiyanlık dünyasının en büyük ve görkemli katedrali.", "suggestedDuration": "2 saat", "category": "tarih"},
                {"id": "rome_6", "name": "Trastevere & Santa Maria Meydanı", "lat": 41.8894, "lng": 12.4705, "day": 3, "description": "Sarmaşıklı dar sokaklar, otantik trattoria lezzetleri.", "suggestedDuration": "3 saat", "category": "lezzet"}
            ]
        }
    elif "istanbul" in d_low:
        return {
            "title": "3 Günlük İstanbul Tarih ve Boğaz Rotası",
            "summary": "Tarihi Yarımada'nın bin yıllık anıtlarından Boğaz kıyılarına uzanan unutulmaz İstanbul turu.",
            "estimatedDays": 3,
            "theme": "Osmanlı ve Bizans Mirası & Boğaz Keyfi",
            "destination": "İstanbul, Türkiye",
            "stops": [
                {"id": "ist_1", "name": "Ayasofya-i Kebir Cami-i Şerifi", "lat": 41.0086, "lng": 28.9802, "day": 1, "description": "1500 yıllık mimari şaheser ve kubbesi.", "suggestedDuration": "2 saat", "category": "tarih"},
                {"id": "ist_2", "name": "Sultanahmet Camii", "lat": 41.0054, "lng": 28.9768, "day": 1, "description": "Mavi çinileri ve 6 minaresiyle simge eser.", "suggestedDuration": "1 saat", "category": "tarih"},
                {"id": "ist_3", "name": "Topkapı Sarayı", "lat": 41.0115, "lng": 28.9833, "day": 1, "description": "Osmanlı İmparatorluğu'nun yönetim merkezi ve Hazine dairesi.", "suggestedDuration": "3 saat", "category": "kultur"},
                {"id": "ist_4", "name": "Kapalıçarşı", "lat": 41.0106, "lng": 28.9680, "day": 2, "description": "Dünyanın en eski ve büyük kapalı çarşılarından biri.", "suggestedDuration": "2 saat", "category": "lezzet"},
                {"id": "ist_5", "name": "Galata Kulesi", "lat": 41.0256, "lng": 28.9741, "day": 2, "description": "360 derece panoramik İstanbul ve Boğaz manzarası.", "suggestedDuration": "1.5 saat", "category": "manzara"},
                {"id": "ist_6", "name": "Ortaköy Meydanı & Boğaz Turu", "lat": 41.0475, "lng": 29.0270, "day": 3, "description": "Boğaz köprüsü manzarası, kumpir ve vapur turu.", "suggestedDuration": "2.5 saat", "category": "manzara"}
            ]
        }
    elif "kapadokya" in d_low:
        return {
            "title": "3 Günlük Kapadokya Peri Bacaları ve Balon Rotası",
            "summary": "Göreme açık hava müzesi, peri bacaları, vadi yürüyüşleri ve yer altı şehri keşfi.",
            "estimatedDays": 3,
            "theme": "Doğa Harikaları & Mağara Kiliseler",
            "destination": "Kapadokya, Nevşehir",
            "stops": [
                {"id": "kap_1", "name": "Göreme Açık Hava Müzesi", "lat": 38.6431, "lng": 34.8289, "day": 1, "description": "Kaya oyma kiliseler ve freskler.", "suggestedDuration": "2.5 saat", "category": "tarih"},
                {"id": "kap_2", "name": "Uçhisar Kalesi", "lat": 38.6299, "lng": 34.8055, "day": 1, "description": "Kapadokya'nın en yüksek seyir noktası.", "suggestedDuration": "1.5 saat", "category": "manzara"},
                {"id": "kap_3", "name": "Paşabağ Rahipler Vadisi", "lat": 38.6775, "lng": 34.8540, "day": 2, "description": "Çok başlı mantar peri bacaları.", "suggestedDuration": "2 saat", "category": "doga"},
                {"id": "kap_4", "name": "Derinkuyu Yer Altı Şehri", "lat": 38.3736, "lng": 34.7347, "day": 3, "description": "8 katlı devasa antik yer altı sığınağı.", "suggestedDuration": "2 saat", "category": "tarih"}
            ]
        }
    elif "paris" in d_low:
        return {
            "title": "3 Günlük Paris Işıklar ve Sanat Rotası",
            "summary": "Eyfel Kulesi'nden Louvre'a, Montmartre ressamlar tepesinden Seine Nehri kıyılarına Paris.",
            "estimatedDays": 3,
            "theme": "Sanat, Mimari & Fransız Gastronomisi",
            "destination": "Paris, Fransa",
            "stops": [
                {"id": "par_1", "name": "Eyfel Kulesi & Champ de Mars", "lat": 48.8584, "lng": 2.2945, "day": 1, "description": "Paris'in simgesi ve panoramik şehir manzarası.", "suggestedDuration": "2.5 saat", "category": "fotograf"},
                {"id": "par_2", "name": "Louvre Müzesi", "lat": 48.8606, "lng": 2.3376, "day": 2, "description": "Dünyanın en prestijli sanat müzesi ve Mona Lisa.", "suggestedDuration": "3.5 saat", "category": "kultur"},
                {"id": "par_3", "name": "Montmartre & Sacré-Cœur", "lat": 48.8867, "lng": 2.3431, "day": 3, "description": "Ressamlar meydanı ve bohem Paris sokakları.", "suggestedDuration": "2.5 saat", "category": "manzara"}
            ]
        }
    else:
        return {
            "title": f"3 Günlük {destination} Keşif Rotası",
            "summary": f"{destination} için özel olarak hazırlanmış en popüler ve büyüleyici duraklar.",
            "estimatedDays": 3,
            "theme": "Kültür, Manzara & Şehir Keşfi",
            "destination": destination,
            "stops": [
                {"id": "gen_1", "name": f"{destination} Tarihi Merkez & Ana Meydan", "lat": 41.0086, "lng": 28.9802, "day": 1, "description": "Şehrin kalbi, tarihi mimari ve popüler buluşma noktası.", "suggestedDuration": "2 saat", "category": "tarih"},
                {"id": "gen_2", "name": f"{destination} Kültür & Sanat Müzesi", "lat": 41.0256, "lng": 28.9741, "day": 2, "description": "Bölgenin zengin tarihini ve sanat eserlerini sergileyen durak.", "suggestedDuration": "2.5 saat", "category": "kultur"},
                {"id": "gen_3", "name": f"{destination} Panoramik Seyir Tepesi", "lat": 41.0345, "lng": 28.9785, "day": 3, "description": "Şehre tepeden bakan en güzel fotoğraf ve gün batımı noktası.", "suggestedDuration": "1.5 saat", "category": "manzara"}
            ]
        }


def get_stay_and_transit(destination):
    return {
        "stays": [
            {"name": f"{destination} Boutique Old Town", "area": "Tarihi Merkez / Şehir İçi", "priceLevel": "Orta - Üst Segment", "description": "Gezilecek yerlere yürüme mesafesinde, otantik mimari ve zengin kahvaltı."},
            {"name": f"{destination} Comfort Suites", "area": "Metro & Ulaşım Aksı", "priceLevel": "Ekonomik - Orta Segment", "description": "Toplu taşımaya ve havaalanı transfer hatlarına çok yakın, modern konaklama."}
        ],
        "transitTips": [
            {"title": "Şehir Kartı / Günlük Bilet", "estimatedCost": "Günlük ~€7 - €15", "description": "Tüm toplu taşıma araçlarında geçerli 24/48 saatlik sınırsız geçiş kartı alarak bütçenizi koruyun."},
            {"title": "Yürüyüş Rotaları", "description": "Tarihi merkezde duraklar birbirine yakın olduğundan rahat yürüyüş ayakkabıları tercih edin."}
        ],
        "cityCardRecommendation": f"{destination} City Pass kartı ile müzelere sıra beklemeden hızlı giriş sağlayabilirsiniz."
    }


def get_discovery_info(destination):
    return {
        "specialties": ["Geleneksel sokak lezzetleri", "Yerel kahve kültürü", "Tarihi tatlıcılar ve fırınlar"],
        "gems": [
            {"name": "Gizli Avlu & Yerel Kitap Kafe", "description": "Turistik kalabalıktan uzak, sakin atmosferde dinlenme ve yerel kahve molası."},
            {"name": "Panoramik Gün Batımı Seyir Terası", "description": "Şehrin silüetini ve gün batımını fotoğraflamak için en keyifli tepe noktası."}
        ],
        "cultureTips": [
            "Müze ve popüler mekanlar için sabahın erken saatlerini veya akşamüzeri saatlerini tercih edin.",
            "Yerel esnaftan alışveriş yaparken nakit veya yerel para birimini yanınızda bulundurun."
        ]
    }


def get_emergency_info(destination):
    return {
        "turkishEmbassyConsulate": {
            "title": f"T.C. {destination} Temsilciliği / Büyükelçilik",
            "address": "Diplomatik Bölge / Konsolosluk Hizmetleri",
            "phone": "+90 312 292 29 29 (Konsolosluk Çağrı Merkezi)",
            "emergencyHotline": "+90 312 292 29 29"
        },
        "localEmergencyNumbers": {
            "generalEmergency": "112 (Acil Çağrı)",
            "police": "112",
            "ambulance": "112",
            "fire": "112"
        },
        "safetyAndPassportTips": [
            "Pasaportunuzun ve vizenizin fotokopisini veya dijital fotoğrafını telefonunuzda saklayın.",
            "Kalabalık turistik alanlarda ve metro istasyonlarında değerli eşyalarınıza dikkat edin."
        ]
    }



def response(status, body, headers):
    return {"statusCode": status, "headers": {**headers, "cache-control": "no-store"}, "body": json.dumps(body)}


def authenticated_owner(event):
    token = event.get("headers", {}).get("authorization", "")
    if not token.startswith("Bearer "):
        return None
    token = token[7:]
    try:
        user = boto3.client("cognito-idp").get_user(AccessToken=token)
        part = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
        if claims.get("client_id") != os.environ.get("CLIENT_ID", "62t35qsehl3o9cdc6i4mg01tqt"):
            return None
        return user["Username"]
    except Exception:
        return None
