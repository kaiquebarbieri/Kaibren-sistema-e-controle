# Banner Debug

The banner URL works correctly in the browser. The image loads fine at:
https://d2xsxph8kpxj0f.cloudfront.net/95597689/XxwarzmhDMwJNs5J3puu6o/1-banners/1773789155357-a02abbfa2989eb0f-2_20250425_144452_0001%20(2).png

The problem is that the URL has spaces in the filename "(2).png" which when put into a WhatsApp message, gets broken. The URL needs to be properly encoded when inserted into the message.

The fix: URL-encode the bannerUrl when adding it to the WhatsApp message, or better yet, encode the filename with spaces when uploading.
