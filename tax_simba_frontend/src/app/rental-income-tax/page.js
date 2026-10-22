import { LandlordService } from '@/components/landlords/LandlordPages';
import { buildPageMetadata } from '@/lib/seo';
export function generateMetadata() { return buildPageMetadata({ title:"MTD for Landlords | Accountant-Led Support | TaxSimba", description:"Plan your landlord MTD service: digital rental records, quarterly updates, annual work and clear responsibilities. Compare current TaxSimba packages.", path:'/rental-income-tax', ogImage:'/images/articles/mtd-for-landlords-2026-27-1440.webp', ogImageAlt:'TaxSimba landlord tax help' }); }
export default function Page() { return <LandlordService kind="MTD"/>; }
