// Asteroid catalog storage — kept outside Pinia so the persist plugin never
// touches these large arrays. shallowRef means .value changes are reactive
// (count display, search), but the array contents are never proxied by Vue.
import { shallowRef } from 'vue';

export const asteroidsNum   = shallowRef([]); // JPL-num
export const asteroidsUnnum = shallowRef([]); // JPL-unnum
