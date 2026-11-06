import ProfilesClient from "./profiles-client";
/** Gerçek kullanıcı profili: /profiles/?u=<kullanıcı> (statik export; Increment 1.12, bug 7). */
export default function Page() {
  return <ProfilesClient />;
}
