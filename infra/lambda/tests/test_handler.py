import base64
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

boto = MagicMock()
with patch.dict(sys.modules, {"boto3": boto}):
    spec = importlib.util.spec_from_file_location("deployed_handler", Path(__file__).parents[1] / "handler.py")
    app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(app)


def event(path, body=None, token=None, method="POST"):
    return {"rawPath": path, "requestContext": {"http": {"method": method}},
            "headers": {"authorization": f"Bearer {token}"} if token else {}, "body": json.dumps(body or {})}


def token(client="62t35qsehl3o9cdc6i4mg01tqt"):
    return "header." + base64.urlsafe_b64encode(json.dumps({"client_id": client}).encode()).decode().rstrip("=") + ".sig"


class ShareAndAuthTests(unittest.TestCase):
    def setUp(self):
        app.table = MagicMock()
        boto.reset_mock()
        self.cognito = MagicMock()
        self.cognito.get_user.return_value = {"Username": "owner-a"}
        boto.client.return_value = self.cognito

    def test_missing_or_invalid_reset_code_never_calls_admin(self):
        for code in ("", "123", "abcdef"):
            result = app.handler(event("/auth/reset-password", {"email": "a@example.com", "newPassword": "LongPassword!123", "code": code}), None)
            self.assertEqual(result["statusCode"], 400)
        self.cognito.confirm_forgot_password.side_effect = ValueError("invalid code")
        result = app.handler(event("/auth/reset-password", {"email": "a@example.com", "newPassword": "LongPassword!123", "code": "123456"}), None)
        self.assertEqual(result["statusCode"], 400)
        self.cognito.admin_set_user_password.assert_not_called()

    def test_valid_reset_uses_cognito_confirmation(self):
        result = app.handler(event("/auth/reset-password", {"email": "a@example.com", "newPassword": "LongPassword!123", "code": "123456"}), None)
        self.assertEqual(result["statusCode"], 200)
        self.cognito.confirm_forgot_password.assert_called_once()
        self.cognito.admin_set_user_password.assert_not_called()

    def test_share_requires_verified_app_session(self):
        for auth in (None, token("other-client")):
            self.assertEqual(app.handler(event("/shares", {}, auth), None)["statusCode"], 401)
        self.cognito.get_user.side_effect = ValueError("invalid token")
        self.assertEqual(app.handler(event("/shares", {}, token()), None)["statusCode"], 401)
        app.table.put_item.assert_not_called()

    def test_rejects_invalid_coordinates_and_unlimited_duration(self):
        for body in ({"lat": "nan", "lng": 2}, {"lat": 91, "lng": 2}, {"lat": 40, "lng": 2, "hours": 0}):
            self.assertEqual(app.handler(event("/shares", body, token()), None)["statusCode"], 400)
        app.table.put_item.assert_not_called()

    def test_share_returns_server_code_and_opaque_link(self):
        result = app.handler(event("/shares", {"lat": 40, "lng": 29, "hours": 24, "code": "client-value"}, token()), None)
        data = json.loads(result["body"])
        self.assertEqual(result["statusCode"], 201)
        self.assertEqual(len(data["code"]), 6)
        self.assertEqual(len(data["token"]), 32)
        self.assertIn("ConditionExpression", app.table.put_item.call_args_list[0].kwargs)

    def test_write_failure_does_not_report_success(self):
        app.table.put_item.side_effect = RuntimeError("database offline")
        self.assertEqual(app.handler(event("/shares", {"lat": 40, "lng": 29}, token()), None)["statusCode"], 503)

    def test_expiry_boundary_and_revocation_block_reads(self):
        for item in ({"expiresAt": 100}, {"expiresAt": 200, "revoked": True}, {"expiresAt": 0}):
            app.table.get_item.return_value = {"Item": item}
            with patch.object(app.time, "time", return_value=100):
                result = app.handler(event("/shares/123456", method="GET"), None)
            self.assertEqual(result["statusCode"], 404)
            self.assertNotIn("lat", json.loads(result["body"]))

    def test_old_link_cannot_resolve_reused_code(self):
        app.table.get_item.side_effect = [{"Item": {"code": "123456"}}, {"Item": {"token": "different", "expiresAt": 9999999999}}]
        result = app.handler(event("/shares/" + "a" * 32, method="GET"), None)
        self.assertEqual(result["statusCode"], 404)

    def test_revoke_is_owner_conditional(self):
        app.table.update_item.side_effect = ValueError("wrong owner")
        self.assertEqual(app.handler(event("/shares/123456/revoke", token=token()), None)["statusCode"], 404)
        self.assertEqual(app.table.update_item.call_args.kwargs["ExpressionAttributeValues"][":owner"], "owner-a")

    def test_public_profile_does_not_return_owner_or_private_fields(self):
        app.table.get_item.return_value = {"Item": {"published": True, "owner": "private-id", "profile": {"username": "traveler", "routes": []}}}
        result = app.handler(event("/profiles/traveler", method="GET"), None)
        self.assertEqual(result["statusCode"], 200)
        self.assertNotIn("private-id", result["body"])
        app.table.get_item.return_value = {"Item": {"published": False}}
        self.assertEqual(app.handler(event("/profiles/traveler", method="GET"), None)["statusCode"], 404)

    def test_public_profile_publishing_requires_owner_and_sanitizes_snapshot(self):
        body = {"username": "traveler", "profile": {"firstName": "A", "email": "private@example.com", "phone": "private", "routes": []}}
        self.assertEqual(app.handler(event("/profile/publish", body), None)["statusCode"], 401)
        self.assertEqual(app.handler(event("/profile/publish", body, token()), None)["statusCode"], 200)
        snapshot = app.table.put_item.call_args.kwargs["Item"]["profile"]
        self.assertNotIn("email", snapshot)
        self.assertNotIn("phone", snapshot)
        self.assertIn("ConditionExpression", app.table.put_item.call_args.kwargs)

    def test_unpublish_checks_owner(self):
        app.table.update_item.side_effect = ValueError("not owner")
        self.assertEqual(app.handler(event("/profile/unpublish", {"username": "traveler"}, token()), None)["statusCode"], 400)
        self.assertIn("#owner = :owner", app.table.update_item.call_args.kwargs["ConditionExpression"])

    def test_bad_json_shape_returns_client_error(self):
        request = event("/shares", token=token())
        request["body"] = "[]"
        self.assertEqual(app.handler(request, None)["statusCode"], 400)



    def test_maintenance_blocks_writes_but_keeps_health_and_reads_available(self):
        app.table.get_item.return_value = {"Item": {"maintenanceMode": True, "maintenanceMessage": "Bakım"}}
        result = app.handler(event("/shares", {"lat": 40, "lng": 29}, token()), None)
        self.assertEqual(result["statusCode"], 503)
        app.table.put_item.assert_not_called()
        self.assertEqual(app.handler(event("/healthz", method="GET"), None)["statusCode"], 200)

    def test_moderated_profile_cannot_be_republished(self):
        app.table.get_item.side_effect = [{"Item": {}}, {"Item": {"adminStatus": "suspended"}}]
        result = app.handler(event("/profile/publish", {"username": "traveler", "profile": {}}, token()), None)
        self.assertEqual(result["statusCode"], 403)
        app.table.put_item.assert_not_called()

    def test_share_feature_switch_blocks_new_links(self):
        app.table.get_item.return_value = {"Item": {"sharesEnabled": False}}
        result = app.handler(event("/shares", {"lat": 40, "lng": 29}, token()), None)
        self.assertEqual(result["statusCode"], 403)
        app.table.put_item.assert_not_called()

if __name__ == "__main__":
    unittest.main()
