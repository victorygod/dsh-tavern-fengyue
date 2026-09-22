// typert artifacts are committed generated sources (see REGENERATE.md).
import { clientBundle } from '../../build/tsdown.client.preset.ts'

/**
 * API package faces: the Host pass emits the node half; the Client pass
 * emits only the browser bundle (typert artifacts are committed generated
 * sources — see REGENERATE.md).
 * `hostPhase: true` steers the faces accordingly (see build/tsdown.client.preset.ts).
 */
export default clientBundle('dsh-tavern-fengyue-api', ['lib/types/index.js'], {
  hostPhase: true,
})
