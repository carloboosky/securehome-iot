import { protectedResourceMetadata, publicOrigin } from "../mcp/oauth.js";

export default function protectedResourceEndpoint(req, res) {
  res.status(200).json(protectedResourceMetadata(publicOrigin(req)));
}
