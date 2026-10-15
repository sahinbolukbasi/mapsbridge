import type { ApiGatewayEvent } from "./http";
import type { VerifiedUser } from "./auth";

export type { VerifiedUser };

export type AuthorizedEvent = ApiGatewayEvent & {
  verifiedUser: VerifiedUser;
};
