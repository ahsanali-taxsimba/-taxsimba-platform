import { LandlordService } from '@/components/landlords/LandlordPages';
import { buildPageMetadata } from '@/lib/seo';
export function generateMetadata() { return buildPageMetadata({ title:"Landlord Self Assessment Tax Return Service | TaxSimba", description:"Accountant-led landlord tax returns. Check service scope, prepare rental records and compare current Self Assessment packages before getting started.", path:'/rental-income-service', ogImage:'/images/articles/self-assessment-for-landlords-2025-26-1440.webp', ogImageAlt:'TaxSimba landlord tax help' }); }
export default function Page() { return <LandlordService kind="SA"/>; }
