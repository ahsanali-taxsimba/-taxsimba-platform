import Link from "next/link";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedParagraph, TranslatedButton } from "@/components/TranslatedContent";
import GetStartedButton from "../re-used/GetStartedButton";
export default function AssessmentSectionGlobal() {
  return (
    <section className="assesment_sec">
      <div className="container">
        <div className="assesment_wrapper_start">
          <div className="row">
            <div className="col-md-8">
              <div className="global_heading white_txt">
                <TranslatedHeadingTwo>
                  Self-Assessment
                </TranslatedHeadingTwo>
                <br />
                <TranslatedHeadingTwo>
                  Made Simple
                </TranslatedHeadingTwo>
                <TranslatedParagraph>Avoid penalties – file accurately and on time.</TranslatedParagraph>
                <GetStartedButton text="Get started" href="/tax-return-form" />
              </div>
            </div>
            <div className="col-md-4">
              <div className="app_image">
                <img src="/images/globe.png" alt="globe" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}