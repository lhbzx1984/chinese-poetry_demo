import Link from "next/link";
import { Icon, type IconName } from "./ui/icons";
import { PaperCard } from "./ui/paper-card";
const features: [IconName, string, string, string, string][] = [
  [
    "mountains",
    "诗人地图",
    "从故乡到远方，循着诗人的脚步，走过他们笔下的山河。",
    "/#map",
    "循迹山河",
  ],
  [
    "library",
    "沉浸书库",
    "按朝代、作者和题材翻开一卷诗书，让文字成为可步入的风景。",
    "/library",
    "翻开诗卷",
  ],
  [
    "film",
    "诗境影片馆",
    "把一首诗的画面、旁白与配乐，珍藏为一段可以重温的时光。",
    "/video",
    "回看片刻",
  ],
];
export default function FeatureCards() {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <span className="section-kicker">三种入境方式</span>
          <h2>每一条路，都通往诗意。</h2>
        </div>
        <p className="section-copy">
          在山河中寻找，在字里行间停留，
          <br />
          也把此刻的心境，留成一帧。
        </p>
      </div>
      <div className="feature-grid">
        {features.map(([icon, title, copy, url, cta]) => (
          <PaperCard className="feature-card" key={title}>
            <div className="feature-art">
              <Icon name={icon} />
            </div>
            <h3>{title}</h3>
            <p>{copy}</p>
            <Link className="ghost-btn" href={url} prefetch={false}>
              {cta}
              <Icon name="next" />
            </Link>
          </PaperCard>
        ))}
      </div>
    </section>
  );
}
