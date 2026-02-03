import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, path }) => {
  const domain = "https://gonogoai.conway.im";
  const url = `${domain}${path || ""}`;
  
  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph (Facebook/LinkedIn) */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={`${domain}/logo-square.webp`} />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${domain}/logo-square.webp`} />
    </Helmet>
  );
};

export default SEO;