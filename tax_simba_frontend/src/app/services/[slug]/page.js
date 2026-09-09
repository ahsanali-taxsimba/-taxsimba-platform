import fetchJSON from '@/lib/fetchJSON';
import { notFound } from 'next/navigation';
import ServiceFAQ from './_sections/ServiceFAQ';
import AssessmentSectionGlobal from '@/components/default/AssesmentSectionGlobalSection.jsx';
import ServiceDetailsClientPage from './page.client';

export const revalidate = 120;

const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://taxsimba.co.uk';

async function getService(slug, { allowNull = false } = {}) {
    const url = `${process.env.NEXT_PUBLIC_API_URL}services/${slug}`;
    const data = await fetchJSON(url, { next: { revalidate: 0 } });
    return data?.data?.services;
}



export async function generateMetadata({ params }) {
    const { slug } = await params;
    const service = await getService(slug, { allowNull: true });

    if (!service) {
        return {
            title: 'Service not found | TaxSimba',
            description: 'The requested service could not be found.',
        };
    }

    const url = `${baseUrl}/services/${slug}`;
    const title = `${service?.metaTitle} | TaxSimba`;
    const description = service?.metaDescription || service.summary;
    const ogImageUrl = service?.featuredImage
        ? service.featuredImage
        : new URL("/images/logo.png", baseUrl).toString();

    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            title,
            description,
            url,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 628,
                    alt: service?.title || "TaxSimba service",
                },
            ],
            // type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [
                {
                    url: ogImageUrl,
                    alt: service?.title || "TaxSimba service",
                },
            ],
        },
        keywords: [
            service.title,
            service.tagline,
            'TaxSimba services',
            'tax advisor',
            'uk tax',
        ],
    };
}

export default async function ServicePage({ params }) {

    const { slug } = await params;
    const service = await getService(slug);
    console.log("dynamic service", service)
    return (
        <ServiceDetailsClientPage service={service} />
    );
}
