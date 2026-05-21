import Image from "next/image";
import Link from "next/link";

const LOGO_PATH = "/logo-default-143x36.png";
const LOGO_WIDTH = 143;
const LOGO_HEIGHT = 36;

const sizeClasses = {
  sm: "h-7 w-auto sm:h-8",
  md: "h-8 w-auto sm:h-9",
  lg: "h-10 w-auto sm:h-12 md:h-14",
} as const;

type BrandLogoProps = {
  size?: keyof typeof sizeClasses;
  href?: string;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  size = "md",
  href,
  className = "",
  priority = false,
}: BrandLogoProps) {
  const image = (
    <Image
      src={LOGO_PATH}
      alt="Impact Logistics"
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      priority={priority}
      className={`object-contain object-left ${sizeClasses[size]} ${className}`}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007bff] focus-visible:ring-offset-2 rounded">
        {image}
      </Link>
    );
  }

  return <span className="inline-flex shrink-0 items-center">{image}</span>;
}
