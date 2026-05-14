import {AbsoluteFill, spring, useVideoConfig, interpolate} from 'remotion';

interface HeroSectionProps {
	progress: number;
	fadeOut: number;
}

export const HeroSection: React.FC<HeroSectionProps> = ({progress, fadeOut}) => {
	const {fps} = useVideoConfig();

	const titleY = spring({
		frame: progress * 30,
		fps,
		config: {
			damping: 100,
			stiffness: 100,
		},
	});

	const subtitleOpacity = interpolate(progress, [0.2, 0.5], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const buttonScale = spring({
		frame: progress * 30 - 15,
		fps,
		config: {
			damping: 100,
			stiffness: 100,
		},
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#f8f9fa',
				opacity: fadeOut,
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				flexDirection: 'column',
				padding: '60px',
			}}
		>
			{/* Background gradient */}
			<div
				style={{
					position: 'absolute',
					width: '100%',
					height: '100%',
					background: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.05) 0%, transparent 70%)',
					pointerEvents: 'none',
				}}
			/>

			{/* Title */}
			<h1
				style={{
					fontSize: '80px',
					fontWeight: 'bold',
					color: '#1a1a1a',
					transform: `translateY(${interpolate(titleY, [0, 1], [50, 0])}px)`,
					opacity: interpolate(titleY, [0, 0.8], [0, 1]),
					textAlign: 'center',
					marginBottom: '20px',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}
			>
				Your Ultimate <span style={{color: '#3b82f6'}}>Template App</span>
			</h1>

			{/* Subtitle */}
			<p
				style={{
					fontSize: '32px',
					color: '#6b7280',
					opacity: subtitleOpacity,
					textAlign: 'center',
					marginBottom: '40px',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}
			>
				Build faster, scale smarter, and focus on what matters most
			</p>

			{/* Button */}
			<div
				style={{
					transform: `scale(${buttonScale})`,
					opacity: interpolate(progress, [0.5, 0.8], [0, 1], {
						extrapolateLeft: 'clamp',
						extrapolateRight: 'clamp',
					}),
				}}
			>
				<div
					style={{
						backgroundColor: '#3b82f6',
						color: 'white',
						padding: '20px 40px',
						borderRadius: '12px',
						fontSize: '24px',
						fontWeight: '600',
						boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)',
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					Get Started
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="5" y1="12" x2="19" y2="12"></line>
						<polyline points="12 5 19 12 12 19"></polyline>
					</svg>
				</div>
			</div>
		</AbsoluteFill>
	);
};