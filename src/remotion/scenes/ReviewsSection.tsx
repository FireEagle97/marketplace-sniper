import {AbsoluteFill, spring, useVideoConfig, interpolate} from 'remotion';

interface ReviewsSectionProps {
	progress: number;
	fadeOut: number;
}

interface ReviewCardProps {
	name: string;
	title: string;
	content: string;
	delay: number;
	progress: number;
}

const ReviewCard: React.FC<ReviewCardProps> = ({name, title, content, delay, progress}) => {
	const {fps} = useVideoConfig();

	const slideIn = spring({
		frame: progress * 30 - delay,
		fps,
		config: {
			damping: 100,
			stiffness: 100,
		},
	});

	return (
		<div
			style={{
				backgroundColor: 'white',
				borderRadius: '16px',
				padding: '32px',
				boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
				transform: `translateX(${interpolate(slideIn, [0, 1], [-50, 0])}px)`,
				opacity: slideIn,
				marginBottom: '24px',
			}}
		>
			<div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
				{[...Array(5)].map((_, i) => (
					<span key={i} style={{color: '#fbbf24', fontSize: '20px'}}>
						★
					</span>
				))}
			</div>
			<p
				style={{
					fontSize: '18px',
					color: '#4b5563',
					marginBottom: '20px',
					lineHeight: '1.6',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}
			>
				"{content}"
			</p>
			<div>
				<p
					style={{
						fontSize: '18px',
						fontWeight: 'bold',
						color: '#1a1a1a',
						marginBottom: '4px',
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					{name}
				</p>
				<p
					style={{
						fontSize: '16px',
						color: '#6b7280',
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					{title}
				</p>
			</div>
		</div>
	);
};

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({progress, fadeOut}) => {
	const titleOpacity = interpolate(progress, [0, 0.3], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	const reviews = [
		{
			name: 'Michael K.',
			title: 'Software Engineer',
			content:
				'This template saved me so much time. I was able to launch my MVP in just a few days!',
		},
		{
			name: 'Sarah J.',
			title: 'Startup Founder',
			content:
				"As a non-technical founder, this template was exactly what I needed to bring my ideas to life.",
		},
		{
			name: 'David L.',
			title: 'Full-stack Developer',
			content:
				'The integration with Supabase and Clerk is seamless. Everything just works out of the box!',
		},
	];

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#ffffff',
				opacity: fadeOut,
				padding: '60px',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
			}}
		>
			<div style={{maxWidth: '1200px', margin: '0 auto', width: '100%'}}>
				<h2
					style={{
						fontSize: '56px',
						fontWeight: 'bold',
						color: '#1a1a1a',
						textAlign: 'center',
						marginBottom: '20px',
						opacity: titleOpacity,
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					Loved by Developers
				</h2>
				<p
					style={{
						fontSize: '24px',
						color: '#6b7280',
						textAlign: 'center',
						marginBottom: '60px',
						opacity: titleOpacity,
						fontFamily: 'system-ui, -apple-system, sans-serif',
					}}
				>
					Join thousands who are building with our template
				</p>

				<div style={{display: 'grid', gap: '24px'}}>
					{reviews.map((review, index) => (
						<ReviewCard
							key={index}
							{...review}
							delay={index * 5}
							progress={progress}
						/>
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
};