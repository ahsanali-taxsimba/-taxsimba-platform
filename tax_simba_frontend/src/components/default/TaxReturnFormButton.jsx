"use client";
import Link from 'next/link'
import React from 'react'
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan,TranslatedText } from "@/components/TranslatedContent";
import { useSession } from 'next-auth/react';
const TaxReturnFormButton = () => {
    const {data:session} = useSession();
    if (!session) {
        return (
            <></>
        )
    }
    return (
        <Link href="/tax-return-form" className="basic_btn" >
           Start My Tax Return
        </Link>
    )
}

export default TaxReturnFormButton
