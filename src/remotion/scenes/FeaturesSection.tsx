import {AbsoluteFill, spring, useVideoConfig, interpolate} from 'remotion';

interface FeaturesSectionProps {
	progress: number;
	fadeOut: number;
}

interface FeatureCardProps {
	icon: string;
	title: string;
	description: string;
	features: string[];
	color: string;
	delay: number;
	progress: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
	icon,
	title,
	description,
	features,
	color,
	delay,
	progress,
}) => {
	const {fps} = useVideoConfig();

	const scale = spring({
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
				padding: '40px',
				boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
				transform: `scale(${scale})`,
				opacity: scale,
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
			}}
		>
			<div
				style={{
					width: '60px',
					height: '60px',
					backgroundColor: `${color}20`,
					borderRadius: '12px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					marginBottom: '24px',
					fontSize: '28px',
				}}
			>
				{icon}
			</div>
			<h3
				style={{
					fontSize: '24px',
					fontWeight: 'bold',
					color: '#1a1a1a',
					marginBottom: '12px',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}
			>
				{title}
			</h3>
			<p
				style={{
					fontSize: '16px',
					color: '#6b7280',
					marginBottom: '24px',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}
			>
				{description}
			</p>
			<ul style={{listStyle: 'none', padding: 0}}>
				{features.map((feature, index) => (
					<li
						key={index}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '12px',
							marginBottom: '12px',
							fontSize: '16px',
							color: '#4b5563',
							fontFamily: 'system-ui, -apple-system, sans-serif',
						}}
					>
						<span style={{color, fontSize: '20px'}}>✓</span>
						{feature}
					</li>
				))}
			</ul>
		</div>
	);
};

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({progress, fadeOut}) => {
	const titleOpacity = interpolate(progress, [0, 0.3], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: '#f3f4f6',
				opacity: fadeOut,
				padding: '60px',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
			}}
		>
			<div style={{maxWidth: '1400px', margin: '0 auto', width: '100%'}}>
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
					Powerful Features
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
					Everything you need to build and scale your projects
				</p>

				<div style={{display: 'flex', gap: '40px'}}>
					<FeatureCard
						icon="⚡"
						title="Modern Stack"
						description="Built with Next.js, Tailwind CSS, and ShadCN UI"
						features={['Server components', 'Type safety', 'Fast rendering']}
						color="#3b82f6"
						delay={10}
						progress={progress}
					/>
					<FeatureCard
						icon="🔒"
						title="Secure Authentication"
						description="Clerk authentication with flexible options"
						features={['Social logins', 'Role-based access', 'OAuth integration']}
						color="#10b981"
						delay={15}
						progress={progress}
					/>
					<FeatureCard
						icon="💾"
						title="Robust Backend"
						description="Supabase and Drizzle integration for seamless data"
						features={['SQL queries', 'Data validation', 'Real-time updates']}
						color="#8b5cf6"
						delay={20}
						progress={progress}
					/>
				</div>
			</div>
		</AbsoluteFill>
	);
};