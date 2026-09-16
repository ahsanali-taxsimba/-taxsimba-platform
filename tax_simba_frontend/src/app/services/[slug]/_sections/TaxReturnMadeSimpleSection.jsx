import { TranslatedHeadingTwo, TranslatedParagraph, TranslatedSpan } from "@/components/TranslatedContent";

export default function TaxReturnMadeSimpleSection({whoWeAreSection}) {
    console.log("whatIsCISSection",whoWeAreSection)
    return (
        <section className="cost_sec who_we">
            <div className="container">
                <div className="row">
                    <div className="col-md-6">
                        <div className="cost_inner">
                            <TranslatedHeadingTwo prefix={<TranslatedSpan className="blue_txt">{whoWeAreSection?.title1}</TranslatedSpan>}>
                                {whoWeAreSection?.title2}
                            </TranslatedHeadingTwo>
                            <TranslatedParagraph>
                                {whoWeAreSection?.description}
                            </TranslatedParagraph>
                        </div>
                    </div>
                     <div className="col-md-6">
                        <div className="cost_image">
                            <img src="/images/who_we.png" alt="" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )

}      
