import { IsBoolean, IsOptional, IsUrl } from "class-validator";
import { Environment } from "@server/env";
import { Public } from "@server/utils/decorators/Public";
import environment from "@server/utils/environment";

class AurigaPluginEnvironment extends Environment {
  /**
   * Base URL of the Auriga service's internal API, reachable from the Outline
   * server (e.g. http://auriga:9742 on the compose network). Never exposed to
   * the browser — all access is proxied through authenticated routes.
   */
  @IsOptional()
  @IsUrl({ require_tld: false, allow_underscores: true })
  public AURIGA_URL = this.toOptionalString(environment.AURIGA_URL);

  /**
   * Whether the Auriga integration is configured — the only signal the
   * frontend receives (via window.env).
   */
  @Public
  @IsBoolean()
  public AURIGA_ENABLED = !!environment.AURIGA_URL;
}

export default new AurigaPluginEnvironment();
