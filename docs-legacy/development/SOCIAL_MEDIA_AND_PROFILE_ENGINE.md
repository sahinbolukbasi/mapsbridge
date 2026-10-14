# Sosyal Medya Platformu, Profil ve Paylaşım Senkronizasyon Kılavuzu

Bu belge, MapsBridge platformundaki sosyal medya akışı (Community Feed), kullanıcı profili (Profile), profil düzenleme (Edit Profile) ve gönderi paylaşma/düzenleme/silme özelliklerinin Mobil ve Web üzerinde eşzamanlı çalışma mimarisini açıklar.

---

## 1. Genel Mimari ve Çift Platform Entegrasyonu

Sosyal medya deneyimi; hem Web (`apps/web`) hem de Mobil (`apps/mobile`) platformlarında tam işlevsel, reaktif ve iki yönlü senkronize olacak şekilde tasarlanmıştır.

```
+-----------------------------------------------------------------------------------+
|                           MapsBridge Social Core                                  |
+-----------------------------------------+-----------------------------------------+
|                WEB                      |                 MOBİL                   |
| (apps/web/app/lib/social-sync.ts)       | (apps/mobile/src/services/socialSync.ts)|
+-----------------------------------------+-----------------------------------------+
| - userStorage ('mapsbridge.posts')      | - AsyncStorage ('mapsbridge.posts')     |
| - CustomEvent ('mapsbridge:posts_upd')  | - Observable Pattern (Set<Callback>)    |
| - CustomEvent ('mapsbridge:profile_upd')| - Observable Pattern (Set<Callback>)    |
| - DiscoverTab & ProfilePage             | - CommunityScreen & ProfileScreen       |
| - EditPostModalWeb                      | - EditPostModal (React Native Modal)    |
| - EditProfilePage (/profile/edit)       | - EditProfileModal                      |
+-----------------------------------------+-----------------------------------------+
```

---

## 2. Profil Yönetimi ve Düzenleme (Profile & Edit Profile)

### 2.1. Profil Veri Modeli
```typescript
export interface UserProfile {
  fullName: string;
  username: string;
  email: string;
  travelTitle: string;
  bio: string;
  location: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  followersCount: number;
  followingCount: number;
  routesCount: number;
  stopsCount: number;
  verified: boolean;
}
```

### 2.2. Web Profil Düzenleme Akışı (`/profile/edit`)
1. Kullanıcı ad, kullanıcı adı, seyahat unvanı, biyografi, konum veya avatar değişikliği yapar.
2. "Değişiklikleri Kaydet" butonuna tıklandığında `handleSaveAll()` çalışır.
3. `webSocialSync.updateProfile(...)` çağrılır:
   - Yerel `mapsbridge.userProfileDetails` güncellenir.
   - `cascadeAuthorToPosts` fonksiyonu ile kullanıcının geçmiş tüm gönderilerindeki yazar ismi, kullanıcı adı ve avatarı otomatik olarak yeni bilgilerle güncellenir.
   - `window.dispatchEvent("mapsbridge:profile_updated")` ve `window.dispatchEvent("mapsbridge:posts_updated")` tetiklenir.
4. Profil sayfası ve Keşfet akışı anında yeni yazar profiliyle yeniden render edilir.

### 2.3. Mobil Profil Düzenleme Akışı (`EditProfileModal.tsx`)
1. Mobil `ProfileScreen` üzerindeki "Düzenle" butonuna dokunulduğunda `EditProfileModal` açılır.
2. Ad, Kullanıcı Adı, Seyahat Unvanı, Biyografi ve Şehir/Ülke alanları anında düzenlenir.
3. "Kaydet" işlemi `socialSyncService.updateUserProfile(...)` fonksiyonunu çalıştırır.
4. Profil güncellenir, yazar bilgileri gönderilere kademeli olarak yansıtılır ve tüm abonelere (`subscribeProfile`, `subscribePosts`) yeni durum bildirilir.

---

## 3. Gönderi Paylaşımı, Düzenleme ve Silme (Post Lifecycle)

### 3.1. Yeni Gönderi / Hızlı Tweet Paylaşımı
- **Web (`apps/web/app/community/page.tsx`):**
  - "Yeni Deneyim Paylaş" modalı veya hızlı "Seyahat Tweeti" kutucuğu üzerinden metin, kategori, konum etiketi ve hashtagler girilir.
  - `webSocialSync.createPost(...)` çağrılarak yeni gönderi akışın en üstüne eklenir.
- **Mobil (`apps/mobile/src/screens/CommunityScreen.tsx`):**
  - `createPostModal` üzerinden seyahat notu, kategori ve rota bağlantısı girilir.
  - `socialSyncService.createPost(...)` çağrılarak yeni gönderi eklenir ve anında akışta listelenir.

### 3.2. Gönderi Düzenleme (In-Place Edit Post)
- Yazar kendi paylaştığı gönderinin sağ üstündeki seçenekler butonuna dokunduğunda/tıkladığında düzenleme modalı açılır:
  - **Web:** `EditPostModalWeb.tsx` modalı açılır; metin, kategori, konum ve etiketler güncellenip `webSocialSync.editPost(postId, updates)` ile kaydedilir.
  - **Mobil:** `EditPostModal.tsx` modalı açılır; aynı alanlar güncellenip `socialSyncService.editPost(postId, updates)` ile kaydedilir.
- Düzenleme tamamlandığında akıştaki ve profil sayfasındaki gönderi yenilenir.

### 3.3. Gönderi Silme (Delete Post)
- Yazar paylaşımını silmek istediğinde onay dialogu gösterilir:
  - Onaylandığında Web'de `webSocialSync.deletePost(postId)` veya Mobil'de `socialSyncService.deletePost(postId)` çalışır.
  - Gönderi akıştan ve profilin "Paylaşımlarım" sekmesinden kaldırılır.

### 3.4. Etkileşimler (Beğeni, Yorum ve Rotayı Seyahate Ekleme)
- **Beğeni (Like):** `toggleLike(postId)` ile anlık olarak beğeni sayısı artırılır/azaltılır ve `likedByMe` durumu yerel olarak korunur.
- **Yorum (Comment):** `addComment(postId, text)` ile yazarın güncel kimliğiyle yorum diziye eklenir.
- **Rotayı Seyahate Ekle (Remix):** Gönderiye bağlı rota tek dokunuşla kullanıcının kendi seyahat planlayıcısına (`travelPlanner`) klonlanır.

---

## 4. Web Profil Sayfasında "Paylaşımlarım" Sekmesi

`apps/web/app/profile/page.tsx` üzerinde 2. sekme olarak "Paylaşımlarım" eklenmiştir:
- Kullanıcının toplulukta paylaştığı tüm gönderiler filtrelenerek listelenir.
- Her gönderi kartında doğrudan "Düzenle" ve "Sil" aksiyon butonları yer alır.
- Boş durumda kullanıcıyı ilk seyahat hikayesini paylaşmaya teşvik eden zarif bir soft kart gösterilir.

---

## 5. Doğrulama ve Testler

Geliştirilen tüm sosyal medya fonksiyonları `apps/web/tests/social-profile-sync.test.cjs` içerisinde otomatik testlere bağlanmıştır:
1. `Profile updates persist correctly and retrieve updated state` - Başarılı
2. `Creating a community post assigns author details and persists in storage` - Başarılı
3. `In-place post editing updates text, category, location, and tags` - Başarılı
4. `Liking a post toggles liked status and increments/decrements like count` - Başarılı
5. `Adding a comment appends to post comments list` - Başarılı
6. `Profile update cascades author name and avatar changes to existing posts` - Başarılı
7. `Deleting a post removes it from storage` - Başarılı
