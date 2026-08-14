import { oauthMetadata, publicOrigin } from "../mcp/oauth.js";

export default function oauthMetadataEndpoint(req, res) {
  res.status(200).json(oauthMetadata(publicOrigin(req)));
}
