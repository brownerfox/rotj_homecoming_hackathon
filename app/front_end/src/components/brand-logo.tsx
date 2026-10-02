import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "mark" | "lockup";
  to?: "/" | "/dashboard" | "/auth";
  inverted?: boolean;
  className?: string;
  imgClassName?: string;
};

export function BrandLogo({
  variant = "mark",
  to,
  inverted = false,
  className,
  imgClassName,
}: BrandLogoProps) {
  const src = variant === "lockup" ? "/f2h-lockup.png" : "/f2h-mark.png";
  const alt = variant === "lockup" ? "Fit2Hire — Personalized Technical Exams" : "Fit2Hire";
  const img = (
    <img
      src={src}
      alt={alt}
      className={cn("h-8 w-auto object-contain", inverted && "brightness-0 invert", imgClassName)}
    />
  );

  if (!to) {
    return <div className={cn("inline-flex items-center", className)}>{img}</div>;
  }

  return (
    <Link to={to} aria-label={alt} className={cn("inline-flex items-center", className)}>
      {img}
    </Link>
  );
}
