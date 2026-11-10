export type Issue = {
  id: string;
  issue_number: number;
  title: string;
  slug: string;
  description: string;
  publication_date: string;
  scheduled_at?: string | null;
  cover_image_url: string | null;
  pdf_url: string | null;
  html_content: string | null;
  status: "draft" | "scheduled" | "published" | "archived";
  departments: string[];
};

export type ArticleDepartment =
  | "tapestry-of-worlds"
  | "frontier-tech"
  | "universal-record";

export type ArticleImage = {
  url: string;
  alt: string;
  caption?: string;
};

export type ArticleReference = {
  title: string;
  url: string;
  accessed_at?: string;
};

export type Article = {
  id: string;
  issue_id: string | null;
  slug: string;
  headline: string;
  author: string;
  department: ArticleDepartment;
  body_markdown: string;
  images: ArticleImage[];
  source_references: ArticleReference[];
  status: "draft" | "scheduled" | "published" | "archived";
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
