export default function PageLink({ href, navigate, children, ...props }) {
  return <a href={href} {...props} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
  }}>{children}</a>
}
