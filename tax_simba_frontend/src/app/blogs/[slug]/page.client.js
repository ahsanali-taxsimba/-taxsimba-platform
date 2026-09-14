import Link from "next/link";
import TranslatedRichText from "@/components/TranslatedRichText";
import { TranslatedHeading, TranslatedHeadingThree, TranslatedLink, TranslatedParagraph } from "@/components/TranslatedContent";
import GetStartedButton from "@/components/re-used/GetStartedButton";

export default function BlogDetailsClientPage({ blogDetails }) {
  console.log("blogDetailsblogDetails", blogDetails)

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  };

  const getConsistentRandomData = (identifier) => {
    let hash = 0;
    const str = String(identifier || "default");
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Pick an author from the list deterministically
    const authors = [
      "George Williams",
      "Jack Robinson ",
      "Harry Collins",
      "Charlie Bennett",
      "Edward Turner",
      "William Carter",
      "Olivia Brown",
      "Emily Taylor",
      "Sophie Clark",
      "Mia Bennett",
      "Matilda Cooper",
      "Emma Johnson",
      "Asim Abbas",
      "Administration Taxsimba"
    ];
    const authorIndex = Math.abs(hash) % authors.length;

    // Pick a date between April 18, 2025 and 30 days from now (or Date.now())
    const startDate = new Date('2025-04-18').getTime();
    const endDate = Date.now();

    const timeDiff = endDate > startDate ? endDate - startDate : 1000 * 60 * 60 * 24 * 30; // 30 days if current is somehow before
    const randomTime = startDate + (Math.abs(hash * 12345) % Math.max(1, timeDiff));

    return {
      author: authors[authorIndex],
      date: new Date(randomTime).toISOString()
    };
  };

  const randomData = getConsistentRandomData(blogDetails?.blog?.slug || blogDetails?.blog?.id);
  const displayAuthor = blogDetails?.blog?.authorName || randomData.author;
  const displayDate = randomData.date; // Use randomized date instead of blogDetails?.blog?.publishedAt

  return (
    <>


      {/* Blog Content */}
      <div className="container">
        {/* Blog Header */}
        <div className="blog-header">
          <img
            src={blogDetails?.blog?.featuredImage || "/images/tax_blog_default.png"}
            alt="Blog"
          />
          <div className="blog-header-content">
            <TranslatedHeading className="blog-title">
              {blogDetails?.blog?.title}
            </TranslatedHeading>
            <TranslatedParagraph className="blog-meta">
              By {displayAuthor} · {formatDate(displayDate)} · {(() => {
                const wordCount = (blogDetails?.blog?.excerpt || "").split(/\s+/).filter(Boolean).length;
                return Math.max(1, Math.ceil(wordCount / 200));
              })()} min read
            </TranslatedParagraph>
            <div className='get_started_centered'><GetStartedButton text="Get started" href="/tax-return-form" variant="pro-blue" /></div>
          </div>
        </div>

        {/* Layout */}
        <div className="blog-layout">
          {/* Main Content */}
          <TranslatedRichText className="blog-content" html={blogDetails?.blog?.content || ""} />

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-box">
              <TranslatedHeadingThree>Recent Posts</TranslatedHeadingThree>

              {blogDetails?.recentBlogs?.slice(0, 4).map((item, index) => {
                return (
                  <div className="recent-post" key={index}>
                    <img
                      src={item?.featuredImage || "/images/tax_blog_default.png"}
                      alt={item?.title || ""}
                    />
                    <Link href={`/blogs/${item?.slug}`}><span>{item?.title}</span></Link>
                  </div>
                )
              })}
            </div>

          </aside>
        </div>
      </div>


    </>
  )
}
