import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { POET_PLACES } from "../src/data/poet-places.ts";
test("路线按原始足迹顺序，二维三维共享数据，标签限额，减少动态效果", async () => {
  const { mapSeries, preferredMapMode } =
    await import("../src/lib/map-options.ts");
  const poet = POET_PLACES.find((p) => p.name === "李白");
  for (const mode of ["2d", "3d"]) {
    const series = mapSeries(POET_PLACES, poet.name, mode, false, true, true);
    assert.deepEqual(
      series[0].data[0].coords.map((c) => c.slice(0, 2)),
      poet.spots.map((s) => [s.lng, s.lat]),
    );
    assert.equal(series[0].effect.show, false);
    assert.equal(series[2].showEffectOn, "emphasis");
    assert.equal(series[2].data.length, poet.spots.length);
    assert.ok(series[1].data.filter((d) => d.label.show).length <= 30);
  }
  assert.equal(preferredMapMode(false, false, 16, false), "2d");
  assert.equal(preferredMapMode(true, true, 4, false), "2d");
  assert.equal(preferredMapMode(true, false, 16, false), "3d");
});
