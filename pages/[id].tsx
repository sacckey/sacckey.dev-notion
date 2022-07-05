import { RichText, Page, Block, getBlock, getAllChildBlocks, getPage } from "../lib/notion"
import Head from 'next/head'
import styles from "./post.module.css"
import Link from "next/link"
import { Fragment } from "react"

export default function Post({ page, blocks }: { page: Page, blocks: Block[] }) {
  const title = 'title' in page.properties.Name ? page.properties.Name.title : null
  const category = 'select' in page.properties.Category ? page.properties.Category.select?.name : ''
  const tags = 'multi_select' in page.properties.Tags ? page.properties.Tags.multi_select : []
  const date = new Intl.DateTimeFormat('ja-JP', {year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo"}).format(new Date(page.created_time))

  return (
    <div>
      <Head>
        {title && (<title>{title[0]?.plain_text}</title>)}
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <article className={styles.container}>
        <p style={{ opacity: 0.65 }}>Posted on {date}</p>
        <h1 className={styles.name}>
          {title && (<Text texts={title} />)}
        </h1>
        <section>
          {blocks.map((block) => (
            <Fragment key={block.id}>{renderBlock(block)}</Fragment>
          ))}
          <div style={{marginBottom: '10px'}}>
            <div>
              Category:{" "}
              <Link href={`/categories/${category}`}>
                <a>{category}</a>
              </Link>
            </div>
            <div>
              Tags:
              {tags.map((tag) => (
                <span key={tag.id}>
                  {" "}
                  <Link href={`/tags/${tag.name}`}>
                    <a>{tag.name}</a>
                  </Link>
                  {" "}
                </span>
              ))}
            </div>
          </div>
          <div>
            <Link href="/">
              <a className={styles.back}>← Go home</a>
            </Link>
          </div>
        </section>
      </article>
    </div>
  )
}

export const Text = ({ texts }: { texts: RichText[] }) => {
  return (
    <>
      {
        texts.map((value, index) => {
          const { plain_text, href, annotations: { bold, code, color, italic, strikethrough, underline } } = value

          return (
            <span
              key={index}
              className={[
                bold ? styles.bold : "",
                code ? styles.code : "",
                italic ? styles.italic : "",
                strikethrough ? styles.strikethrough : "",
                underline ? styles.underline : "",
              ].join(" ")}
              style={color !== "default" ? { color } : {}}
            >
              {href ? <a href={href}>{plain_text}</a> : plain_text}
            </span>
          )
        })
      }
    </>
  )
}

const renderBlock = (block: Block) => {
  const { id, type } = block

  switch (type) {
    case "paragraph":
      return (
        <p>
          <Text texts={block[type].rich_text} />
        </p>
      )
    case "heading_1":
      return (
        <h1>
          <Text texts={block[type].rich_text} />
        </h1>
      )
    case "heading_2":
      return (
        <h2>
          <Text texts={block[type].rich_text} />
        </h2>
      )
    case "heading_3":
      return (
        <h3>
          <Text texts={block[type].rich_text} />
        </h3>
      )
    case "bulleted_list_item":
      return (
        <ul>
          <li><Text texts={block[type].rich_text} /></li>
          {block.children?.map((child) => <Fragment key={child.id}>{renderBlock(child)}</Fragment>)}
          {block.brothers?.map((brother) =>
            <Fragment key={brother.id}>
              {type in brother && (<li><Text texts={brother[type].rich_text} /></li>)}
              {brother.children?.map((child) => <Fragment key={child.id}>{renderBlock(child)}</Fragment>)}
            </Fragment>
          )}
        </ul>
      )
    case "numbered_list_item":
      return (
        <ol>
          <li><Text texts={block[type].rich_text} /></li>
          {block.children?.map((child) => <Fragment key={child.id}>{renderBlock(child)}</Fragment>)}
          {block.brothers?.map((brother) =>
            <Fragment key={brother.id}>
              {type in brother && (<li><Text texts={brother[type].rich_text} /></li>)}
              {brother.children?.map((child) => <Fragment key={child.id}>{renderBlock(child)}</Fragment>)}
            </Fragment>
          )}
        </ol>
      )
    case "to_do":
      return (
        <div>
          <label htmlFor={id}>
            <input type="checkbox" id={id} defaultChecked={block[type].checked} />{" "}
            <Text texts={block[type].rich_text} />
          </label>
        </div>
      )
    case "toggle":
      return (
        <details>
          <summary>
            <Text texts={block[type].rich_text} />
          </summary>
          {block.children?.map((child) => (
            <Fragment key={child.id}>{renderBlock(child)}</Fragment>
          ))}
        </details>
      )
    case "child_page":
      return <p>{block[type].title}</p>
    case "divider":
      return <hr key={id} />
    case "quote":
      return <blockquote key={id}>{block[type].rich_text[0].plain_text}</blockquote>
    case "code":
      return (
        <pre className={styles.pre}>
          <code className={styles.code_block} key={id}>
            {block[type].rich_text[0].plain_text}
          </code>
        </pre>
      )
    case "bookmark":
      const href = block[type].url
      return (
        <a href={ href } target="_brank" className={styles.bookmark}>
          { href }
        </a>
      )
    default:
      return `❌ Unsupported block (${
        type === "unsupported" ? "unsupported by Notion API" : type
      })`
    }
  }

export const getStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export const getStaticProps = async (context: { params: { id: string } }) => {
  try {
    const { id } = context.params
    const page = await getPage(id)
    if ('checkbox' in page.properties.Published && !page.properties.Published.checkbox) return { notFound: true }

    const block = await getBlock(id)
    const blocks = await getAllChildBlocks(block)

    return {
      props: {
        page,
        blocks,
      },
      revalidate: 60 * 10
    }
  } catch (e) {
    throw new Error(`Failed to fetch post, received status ${e}`)
  }
}
