import logo from "@/assets/logo-prato.png";

type Props = { className?: string; alt?: string };

export function Logo({ className = "h-9 w-auto", alt = "Pratô" }: Props) {
  return <img src={logo} alt={alt} className={className} />;
}
