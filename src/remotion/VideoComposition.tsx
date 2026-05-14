import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {HeroSection} from './scenes/HeroSection';
import {FeaturesSection} from './scenes/FeaturesSection';
import {ReviewsSection} from './scenes/ReviewsSection';
import {CTASection} from './scenes/CTASection';

export const VideoComposition = () => {
	const frame = useCurrentFrame();

	// Define scene timings (in frames)
	const heroStart = 0;
	const heroEnd = 90; // 3 seconds

	const featuresStart = 90;
	const featuresEnd = 180; // 3 seconds

	const reviewsStart = 180;
	const reviewsEnd = 270; // 3 seconds

	const ctaStart = 270;
	const ctaEnd = 360; // 3 seconds

	return (
		<AbsoluteFill style={{backgroundColor: '#ffffff'}}>
			{/* Hero Section */}
			{frame >= heroStart && frame < heroEnd && (
				<HeroSection
					progress={interpolate(
						frame,
						[heroStart, heroEnd - 20, heroEnd],
						[0, 1, 1]
					)}
					fadeOut={interpolate(
						frame,
						[heroEnd - 20, heroEnd],
						[1, 0],
						{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
					)}
				/>
			)}

			{/* Features Section */}
			{frame >= featuresStart && frame < featuresEnd && (
				<FeaturesSection
					progress={interpolate(
						frame,
						[featuresStart, featuresStart + 20, featuresEnd - 20, featuresEnd],
						[0, 1, 1, 1]
					)}
					fadeOut={interpolate(
						frame,
						[featuresEnd - 20, featuresEnd],
						[1, 0],
						{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
					)}
				/>
			)}

			{/* Reviews Section */}
			{frame >= reviewsStart && frame < reviewsEnd && (
				<ReviewsSection
					progress={interpolate(
						frame,
						[reviewsStart, reviewsStart + 20, reviewsEnd - 20, reviewsEnd],
						[0, 1, 1, 1]
					)}
					fadeOut={interpolate(
						frame,
						[reviewsEnd - 20, reviewsEnd],
						[1, 0],
						{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
					)}
				/>
			)}

			{/* CTA Section */}
			{frame >= ctaStart && frame <= ctaEnd && (
				<CTASection
					progress={interpolate(
						frame,
						[ctaStart, ctaStart + 20, ctaEnd],
						[0, 1, 1]
					)}
				/>
			)}
		</AbsoluteFill>
	);
};