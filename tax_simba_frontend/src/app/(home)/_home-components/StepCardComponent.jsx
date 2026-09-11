import { TranslatedHeadingFive, TranslatedHeadingThree, TranslatedParagraph } from "@/components/TranslatedContent";

export default function StepCardComponent({ lineBtmClassName = '', stepSvg = '', ...props }) {
  return (
    <div className={props.divClassName}>
      <div className="step_image">
        <div className="step_num">
          <TranslatedHeadingFive>Step</TranslatedHeadingFive>
          <span>{props.stepNumber}</span>
        </div>
        <figure>
          <img src={props.stepImageSrc} alt="step_image" />
        </figure>
        <div className={lineBtmClassName}>
          {stepSvg}

        </div>
      </div>
      <div className="step_details">
        <div className="step_details_paragraph">
          <TranslatedHeadingThree>{props.stepH3}</TranslatedHeadingThree>
          <TranslatedParagraph>
            {props.stepParagraph}
          </TranslatedParagraph>
        </div>
      </div>
    </div>
  )
}