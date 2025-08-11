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
  const xmlBody = builder.build(xbelObject);
  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE xbel PUBLIC "+//IDN python.org//DTD XML Bookmark Exchange Language 1.0//EN//XML" "http://pyxml.sourceforge.net/topics/dtds/xbel.dtd">\n';
  return header + xmlBody;
}
