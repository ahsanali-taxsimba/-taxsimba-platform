// "use client";
// import { useTranslate } from "@/hooks/useTranslate";
import StepCardComponent from "./StepCardComponent";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedParagraph, TranslatedButton } from "@/components/TranslatedContent";

export default function HowItWorksSectionDetails({ howItWorksSection }) {
    // const translatedTitle = useTranslate("How It Works");
    //   const translatedDescription = useTranslate("Establishing residency made easy — we're with you every step.");
    // console.log("howItWorksSection",howItWorksSection)
    const [title1, title2, title3, title4] = howItWorksSection?.items?.map(item => item.title)
    const [description1, description2, description3, description4] = howItWorksSection?.items?.map(item => item.description)
    console.log("howItWorksSection", title1)
    return (
        <section className="how_it_works">
            <div className="container">
                <div className="global_heading text-center">
                    <TranslatedHeadingTwo>
                        {howItWorksSection.title1}
                    </TranslatedHeadingTwo>
                    <TranslatedParagraph>
                        {howItWorksSection.description}
                    </TranslatedParagraph>
                </div>
                <div className="how_it_works_holder">
                    <div className="how_it_works_row">
                        <div className="step_box_wrapper wrapper_one">
                            <StepCardComponent
                                divClassName="step_box bg_light_green"
                                stepNumber="01"
                                stepImageSrc="/images/step_img1.png"
                                lineBtmClassName="line_btm frst_line"
                                stepSvg={<svg
                                    viewBox="0 0 308 186"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        className="dashed-slide"
                                        d="M305.639 16H182.639C148.639 16 147.639 40.6218 147.639 50V151.5C148.093 162.541 142.8 184.622 118 184.622C93.2 184.622 22.3333 184.622 0 184.622M287.139 1L306.639 17L287.139 36"
                                        stroke="#6E6E6E"
                                        strokeDasharray="4 4"
                                    />
                                </svg>}
                                stepH3={title1}
                                stepParagraph={description1}
                            />

                        </div>
                        <div className="step_box_wrapper wrapper_two">
                            <StepCardComponent
                                divClassName="step_box bg_light_blue"
                                stepNumber="02"
                                stepImageSrc="/images/step_img2.png"
                                lineBtmClassName="line_btm second_line"
                                stepSvg={<svg
                                    viewBox="0 0 153 215"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        className="dashed-slide-2"
                                        d="M0.503434 2.16425L101.999 1.21349C111.377 1.12564 136.007 1.89496 136.325 35.8935C136.325 35.8935 137.028 165.856 137.477 213.888M152.304 200.248L137.487 213.897L117.305 200.576"
                                        stroke="#6E6E6E"
                                        strokeDasharray="4 4"
                                    />
                                </svg>}
                                stepH3={title2}
                                stepParagraph={description2}
                            />

                        </div>
                    </div>
                    <div className="how_it_works_row">
                        <div className="step_box_wrapper wrapper_one">
                            <StepCardComponent
                                divClassName="step_box bg_light_pink"
                                stepNumber="03"
                                stepImageSrc="/images/step_img3.png"
                                lineBtmClassName="line_btm third_line"
                                stepSvg={<svg
                                    viewBox="0 0 521 176"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        className="dashed-slide"
                                        d="M1.99982 159.622H485C519 159.622 520 135 520 125.622V24.1218C521.833 16.2885 519.2 0.621826 494 0.621826C468.8 0.621826 407.833 0.621826 380.5 0.621826M17.4998 175.622L0.999817 159.622L17.4998 140.622"
                                        stroke="#6E6E6E"
                                        strokeDasharray="4 4"
                                    />
                                </svg>}
                                stepH3={title3}
                                stepParagraph={description3}
                            />
                        </div>
                        <div className="step_box_wrapper wrapper_two">
                            <StepCardComponent
                                divClassName="step_box bg_light_purple"
                                stepNumber="04"
                                stepImageSrc="/images/step_img4.png"
                                stepH3={title4}
                                stepParagraph={description4}
                            />

                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}