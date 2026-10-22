import { LandlordHub } from '@/components/landlords/LandlordPages';
import { buildPageMetadata } from '@/lib/seo';
export function generateMetadata() { return buildPageMetadata({ title:"Landlord Tax Help, Services & Guides | TaxSimba", description:"Find the right landlord tax help: annual Self Assessment, ongoing MTD support, rental records and practical property guides from TaxSimba.", path:'/landlords', ogImage:'/images/articles/self-assessment-for-landlords-2025-26-1440.webp', ogImageAlt:'TaxSimba landlord tax help' }); }
export default function Page() { return <LandlordHub/>; }
