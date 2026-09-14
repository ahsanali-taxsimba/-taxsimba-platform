import { TranslatedSpan } from "@/components/TranslatedContent";

export default function SmartTax({ articles }) {
    return (
        <>
            <section className="smart_tax">
                <div className="container">
                    <div className="row gap-3 gap-lg-0">
                        <div className="col-lg-5">
                            <div className="blog_img_toppart">
                                <img src={articles[0]?.featuredImage || "images/blog_dtls.jpg"} alt="" />
                            </div>
                        </div>
                        <div className="col-lg-7">
                            <div className="blog_txt_dtls">
                                <div className="news_bx">
                                    <TranslatedSpan>News!</TranslatedSpan>
                                    8 min read
                                </div>
                                <h2>{articles[0]?.title}</h2>
                                {articles[0]?.excerpt && <p>
                                    {articles[0]?.excerpt}
                                </p>}
                            </div>
                        </div>
                    </div>
                </div>
            </section>




        </>
    );
}