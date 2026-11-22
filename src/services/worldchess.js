const PROFILE_BASE = "https://worldchess.com/profile/";

/**
 * World Chess exposes public player pages and archives, but no documented
 * third-party public JSON API was found. This adapter deliberately links to
 * the official public profile rather than scraping undocumented endpoints or
 * inventing ratings/game data.
 */
function profileId(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("Enter a World Chess profile ID or profile URL.");
  const match = input.match(/(?:worldchess\.com\/profile\/)?([0-9]{3,})(?:[/?#].*)?$/i);
  if (!match) throw new Error("Use a numeric World Chess profile ID or a URL like https://worldchess.com/profile/123456.");
  return match[1];
}

export class WorldChessService {
  async getProfile(value) {
    const id = profileId(value);
    const profileUrl = PROFILE_BASE + encodeURIComponent(id);
    return {
      id,
      username: id,
      name: "World Chess player " + id,
      platform: "World Chess",
      profileUrl,
      url: profileUrl,
      externalOnly: true,
    };
  }

  async getRatings(value) {
    const profile = await this.getProfile(value);
    return { externalOnly: true, profileUrl: profile.profileUrl, source: "World Chess public profile" };
  }

  async getRecentGames(value) {
    await this.getProfile(value);
    return [];
  }

  async getGamePGN() {
    throw new Error("World Chess does not document a public third-party PGN API. Open the player's public profile to view and download available games.");
  }
}
