import {Composition} from 'remotion';
import {VideoComposition} from './VideoComposition';

export const ShowcaseVideo = () => {
	return (
		<>
			<Composition
				id="ShowcaseVideo"
				component={VideoComposition}
				durationInFrames={360} // 12 seconds at 30fps
				fps={30}
				width={1920}
				height={1080}
			/>
		</>
	);
};