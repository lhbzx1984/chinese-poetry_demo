import HomeHero from "@/components/home-hero";
import MapExplorer from "@/components/map-explorer";
import FeatureCards from "@/components/feature-cards";
import DailyPoem from "@/components/daily-poem";
import MoodTiles from "@/components/mood-tiles";
import { InkDivider } from "@/components/ui/ink-divider";
import fs from "node:fs";
import path from "node:path";

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1}>
      <HomeHero
        videoAvailable={fs.existsSync(
          path.join(process.cwd(), "public/media/hero-landscape.mp4"),
        )}
      />
      <FeatureCards />
      <InkDivider />
      <DailyPoem />
      <MoodTiles />
      <MapExplorer />
    </main>
  );
}
