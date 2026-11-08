export default function BrandMark({ size = 40, className = '' }) {
  return (
    <img
      src="/icons8-books-50.png"
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }}
      aria-hidden="true"
    />
  );
}
