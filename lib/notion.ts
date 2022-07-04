import { Client } from "@notionhq/client"
import { QueryDatabaseResponse, ListBlockChildrenResponse } from '@notionhq/client/build/src/api-endpoints.d'

export type Page = Extract<QueryDatabaseResponse['results'][number], {properties: unknown}>
export type Block = Extract<ListBlockChildrenResponse['results'][number], {has_children: unknown}> & {
  children?: Block[],
  brothers?: Block[]
}
export type RichText = Extract<Page['properties']['Name'], {title: unknown}>['title'][number]

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

export const getDatabase = async (): Promise<Page[]> => {
  const pages: Page[] = []
  const databaseId = process.env.NOTION_DATABASE_ID || ''
  const { results } = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [{
        "property": "Published",
        "checkbox": {
          "equals": true
        }
      }]
    }
  })

  for (const page of results) if ('properties' in page) pages.push(page)

  return pages
}

export const getPage = async (pageId: string): Promise<Page> => {
  const response = await notion.pages.retrieve({ page_id: pageId })

  if ('properties' in response) return response

  throw new Error('properties is not in response')
}

export const getBlock = async (blockId: string): Promise<Block> => {
  const response = await notion.blocks.retrieve({ block_id: blockId })

  if ('has_children' in response) return response

  throw new Error('has_children is not in response')
}

export const getChildBlocks = async (blockId: string): Promise<Block[]> => {
  const blocks: Block[] = []
  let cursor
  while (true) {
    const { results, next_cursor }: { results: ListBlockChildrenResponse['results'], next_cursor: string | null } = await notion.blocks.children.list({
      start_cursor: cursor,
      block_id: blockId,
    })

    for(const block of results) if ('has_children' in block) blocks.push(block)

    if (!next_cursor) break

    cursor = next_cursor
  }

  return blocks
}

export const getAllChildBlocks = async (block: Block): Promise<Block[]> => {
  const childBlocks: Block[] = await getChildBlocks(block.id)
  const mergedChildBlocks: Block[] = []

  for (let i = 0; i < childBlocks.length; i++) {
    const childBlock = childBlocks[i]

    if (childBlock.has_children) {
      childBlock.children = await getAllChildBlocks(childBlock)
    }

    if (i===0) {
      mergedChildBlocks.push(childBlock)
      continue
    }

    const firstChildBlock = mergedChildBlocks[mergedChildBlocks.length - 1]
    if (!firstChildBlock) throw new Error('failed to fetch child blocks')

    if (firstChildBlock.type === childBlock.type && (firstChildBlock.type === "bulleted_list_item" || firstChildBlock.type === "numbered_list_item")){
      firstChildBlock.brothers = firstChildBlock.brothers || []
      firstChildBlock.brothers.push(childBlock)
    }
    else {
      mergedChildBlocks.push(childBlock)
    }
  }

  return mergedChildBlocks
}
