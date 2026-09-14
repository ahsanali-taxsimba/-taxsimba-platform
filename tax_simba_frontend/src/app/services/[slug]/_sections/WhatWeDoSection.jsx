import GetStartedButton from "@/components/re-used/GetStartedButton"
import { TranslatedHeadingFour, TranslatedHeadingTwo, TranslatedLink, TranslatedParagraph, TranslatedSpan } from "@/components/TranslatedContent"

export default function WhatWeDoSection({whatWeDoSection}) {
    const wrapperBox = [
    {imageSrc:"/images/choose1.png", heading : "UK Certified Experts", para:"Get your taxes done by qualified professionals"},
    {imageSrc:"/images/choose2.png", heading : "Fast Turnaround", para:"Returns filed within 48 hours"},
    {imageSrc:"/images/choose3.png", heading : "Human Support", para:"Talk to a real accountant – no bots"},
    {imageSrc:"/images/choose4.png", heading : "Data Security", para:"Bank-grade encryption keeps your info safe"},
    {imageSrc:"/images/choose5.png", heading : "100% Online", para:"File from your phone or laptop – no appointments"},
    {imageSrc:"/images/choose6.png", heading : "Fixed Pricing", para:"No hidden fees. One flat, transparent price."}
  ]
  console.log("whatWeDoSection",whatWeDoSection)
    return (
        <section className="choose_us_section what_we_do">
           <div className="container">
             <div className="global_heading text-center">
               <TranslatedHeadingTwo><TranslatedSpan className="blue_txt">What We Do</TranslatedSpan>{whatWeDoSection.title2}</TranslatedHeadingTwo>
             </div>
             <div className="choose_wrapper">
               {
                 whatWeDoSection?.items.map((item,index)=>{
                    return (
                     <div className="wrapper_box" key={index}>
                 <figure>
                   <img src={wrapperBox[index].imageSrc} alt="Choose_image" />
                 </figure>
                 <TranslatedHeadingFour>{item.title}</TranslatedHeadingFour>
                 <TranslatedParagraph>{item.description}</TranslatedParagraph>
               </div>
                    )
                 })
       
               }
               
             </div>
           </div>
           <div className='get_started_centered'><GetStartedButton text="Get started" href="/tax-return-form" variant="pro-blue"/></div>
         </section>
    )
}