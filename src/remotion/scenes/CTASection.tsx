import {AbsoluteFill, spring, useVideoConfig, interpolate} from 'remotion';

interface CTASectionProps {
	progress: number;
}

export const CTASection: React.FC<CTASectionProps> = ({progress}) => {
	const {fps} = useVideoConfig();

	const scale = spring({
		frame: progress * 30,
		fps,
		config: {
			damping: 100,
			stiffness: 100,
		},
	});

	const buttonScale = spring({
		frame: progress * 30 - 10,
		fps,
		config: {
			damping: 100,
			stiffness: 100,
		},
	});

	const shimmerPosition = interpolate(
		progress,
		[0.5, 1],
		[-100, 200],
		{
			extrapolateLeft: 'clamp',
			extrapolateRight: 'extend',
		}
	);

	return (
		<AbsoluteFill
			style={{
				background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				padding: '60px',
			}}
		>
			{/* Background pattern */}
			<div
				style={{
					position: 'absolute',
					width: '100%',
					height: '100%',
					opacity: 0.1,
					backgroundImage: `repeating-linear-gradient(
						45deg,
						transparent,
						transparent 35px,
						rgba(255,255,255,.1) 35px,
						rgba(255,255,255,.1) 70px
					)`,
				}}
			/>

			<div
				style={{
					backgroundColor: 'rgba(255, 255, 255, 0.95)',
					borderRadius: '24px',
					padding: '80px',
					boxShadow: '0 25px 50px rgba(0, 0, 0, 0.2)',
					transform: `scale(${scale})`,
					opacity: scale,
					textAlign: 'center',
					position: 'relative',
					overflow: 'hidden',
					maxWidth: '800px',
				}}
			>
				{/* Shimmer effect */}
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)`,
						transform: `translateX(${shimmerPosition}%)`,
						pointerEvents: 'none',
					}}
				/>

				<h2
					style={{
						fontSize: '48px',
						fontWeight: 'bold',
						color: '#1a1a1a',
						marginBottom: '20px',
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					Ready to Get Started?
				</h2>
				<p
					style={{
						fontSize: '24px',
						color: '#6b7280',
						marginBottom: '40px',
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					Join thousands of developers building with our template
				</p>

				<div
					style={{
						display: 'flex',
						gap: '20px',
						justifyContent: 'center',
						transform: `scale(${buttonScale})`,
					}}
				>
					<div
						style={{
							backgroundColor: '#3b82f6',
							color: 'white',
							padding: '20px 40px',
							borderRadius: '12px',
							fontSize: '20px',
							fontWeight: '600',
							boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)',
							fontFamily: 'system-ui, -apple-system, sans-serif',
						}}
					>
						Get Started
					</div>
					<div
						style={{
							backgroundColor: 'transparent',
							color: '#3b82f6',
							padding: '20px 40px',
							borderRadius: '12px',
							fontSize: '20px',
							fontWeight: '600',
							border: '2px solid #3b82f6',
							fontFamily: 'system-ui, -apple-system, sans-serif',
						}}
					>
						View Documentation
					</div>
				</div>

				{/* Logo/Brand */}
				<div
					style={{
						marginTop: '60px',
						fontSize: '32px',
						fontWeight: 'bold',
						color: '#6366f1',
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					Template App
				</div>
			</div>
		</AbsoluteFill>
	);
};