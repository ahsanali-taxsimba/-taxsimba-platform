import Link from "next/link";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedText } from "@/components/TranslatedContent";
import GetStartedButton from "@/components/re-used/GetStartedButton";
export default function FileTaxSection() {
  return (
    <section
      className="file_tax"
      style={{ backgroundImage: "url(/images/footer_bg.png)" }}
    >
      <div className="container">
        <div className="global_heading text-center white_txt">
          <TranslatedHeadingTwo>
            Simplify your Self-Assessment process. File correctly and punctually
            to dodge penalties.
          </TranslatedHeadingTwo>
          <TranslatedParagraph>Get Your Tax Return Started</TranslatedParagraph>
          <GetStartedButton text="Get started" href="/tax-return-form" />
        </div>
      </div>
    </section>
  )
}