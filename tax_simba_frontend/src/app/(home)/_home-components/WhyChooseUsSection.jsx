import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedParagraph, TranslatedButton, TranslatedSpan,TranslatedText, TranslatedLink } from "@/components/TranslatedContent";
export default function WhyChooseUsSection(){
  const wrapperBox = [
    {imageSrc:"/images/choose1.png", heading : "UK Certified Experts", para:"Get your taxes done by qualified professionals"},
    {imageSrc:"/images/choose2.png", heading : "Fast Turnaround", para:"Returns filed within 48 hours"},
    {imageSrc:"/images/choose3.png", heading : "Human Support", para:"Talk to a real accountant – no bots"},
    {imageSrc:"/images/choose4.png", heading : "Data Security", para:"Bank-grade encryption keeps your info safe"},
    {imageSrc:"/images/choose5.png", heading : "100% Online", para:"File from your phone or laptop – no appointments"},
    {imageSrc:"/images/choose6.png", heading : "Fixed Pricing", para:"No hidden fees. One flat, transparent price."}
  ]
    return(
        <section className="choose_us_section">
    <div className="container">
      <div className="global_heading text-center">
        <TranslatedHeadingTwo>Why Choose Us</TranslatedHeadingTwo>
      </div>
      <div className="choose_wrapper">
        {
          wrapperBox.map((item,index)=>{
             return (
              <div className="wrapper_box" key={index}>
          <figure>
            <img src={item.imageSrc} alt="choose_image" />
          </figure>
          <TranslatedHeadingFour>{item.heading}</TranslatedHeadingFour>
          <TranslatedParagraph>{item.para}</TranslatedParagraph>
        </div>
             )
          })

        }
        
      </div>
    </div>
  </section>
    )
}
