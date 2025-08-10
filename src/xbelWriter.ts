import { XMLBuilder } from 'fast-xml-parser';

export interface XbelItem {
  title: string;
  url: string;
  chosenCategory: string;
}

export function buildXbel(items: XbelItem[], allCategories?: string[]): string {
  const categoryToItems = new Map<string, XbelItem[]>();
  for (const item of items) {
    const arr = categoryToItems.get(item.chosenCategory) || [];
    arr.push(item);
    categoryToItems.set(item.chosenCategory, arr);
  }

  const categories = allCategories && allCategories.length > 0
    ? allCategories
    : Array.from(categoryToItems.keys());

  const xbelObject: any = {
    xbel: {
      '@_version': '1.0',
      folder: categories
        .map((cat) => {
          const catItems = categoryToItems.get(cat) || [];
          if (catItems.length === 0) return null;
          return {
            title: cat,
            bookmark: catItems.map((b) => ({
              '@_href': b.url,
              title: b.title,
            })),
          };
        })
        .filter(Boolean),
    },
  };

  const builder = new XMLBuilder({
    attributeNamePrefix: '@_',
    ignoreAttributes: false,
    suppressEmptyNode: true,
    format: true,
    indentBy: '  ',
  });
  return builder.build(xbelObject);
}
