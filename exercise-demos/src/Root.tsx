import "./index.css";
import { Composition } from "remotion";
import { SquatDemo } from "./SquatDemo";
import { DURATION, FPS } from "./motion";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="SquatLandscape" component={SquatDemo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
      <Composition id="SquatPortrait" component={SquatDemo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
    </>
  );
};
