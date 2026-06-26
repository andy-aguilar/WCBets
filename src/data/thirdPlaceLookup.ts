import thirdPlaceLookupJson from "../../legacy-app/third-place-lookup.json";
import type { ThirdPlaceLookup } from "../lib/types";

export const thirdPlaceLookup =
  thirdPlaceLookupJson as unknown as ThirdPlaceLookup;
