const DROPS = Array.from({ length: 42 }, (_, i) => ({
  left: `${(i * 17 + 8) % 100}%`,
  delay: `${(i * 0.37) % 4.8}s`,
  duration: `${2.4 + (i % 7) * 0.28}s`,
  height: `${10 + (i % 5) * 3}vh`,
  opacity: 0.18 + (i % 5) * 0.06,
}));

export function RainLayer() {
  return (
    <div className="rain-layer" aria-hidden="true">
      {DROPS.map((d, i) => (
        <span
          key={i}
          style={{
            left: d.left,
            animationDelay: d.delay,
            animationDuration: d.duration,
            height: d.height,
            opacity: d.opacity,
          }}
        />
      ))}
    </div>
  );
}
