// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded "><a href="index.html"><strong aria-hidden="true">1.</strong> Intro</a></li><li class="chapter-item expanded "><a href="basics/index.html"><strong aria-hidden="true">2.</strong> Basics</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="basics/non_determinism.html"><strong aria-hidden="true">2.1.</strong> non_determinism</a></li><li class="chapter-item expanded "><a href="basics/delegations.html"><strong aria-hidden="true">2.2.</strong> delegations</a></li><li class="chapter-item expanded "><a href="basics/recursion.html"><strong aria-hidden="true">2.3.</strong> recursion</a></li><li class="chapter-item expanded "><a href="basics/field.html"><strong aria-hidden="true">2.4.</strong> field</a></li><li class="chapter-item expanded "><a href="basics/polynomials.html"><strong aria-hidden="true">2.5.</strong> polynomials</a></li><li class="chapter-item expanded "><a href="basics/trace.html"><strong aria-hidden="true">2.6.</strong> trace</a></li><li class="chapter-item expanded "><a href="basics/constraint.html"><strong aria-hidden="true">2.7.</strong> constraint</a></li><li class="chapter-item expanded "><a href="basics/memory.html"><strong aria-hidden="true">2.8.</strong> memory</a></li><li class="chapter-item expanded "><a href="basics/single_column_proof.html"><strong aria-hidden="true">2.9.</strong> single_column_proof</a></li></ol></li><li class="chapter-item expanded "><a href="advanced/index.html"><strong aria-hidden="true">3.</strong> Advanced</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="advanced/columns_memory.html"><strong aria-hidden="true">3.1.</strong> columns_memory</a></li><li class="chapter-item expanded "><a href="advanced/columns_setup.html"><strong aria-hidden="true">3.2.</strong> columns_setup</a></li><li class="chapter-item expanded "><a href="advanced/lookups_and_rangechecks.html"><strong aria-hidden="true">3.3.</strong> lookups_and_rangechecks</a></li><li class="chapter-item expanded "><a href="advanced/fri_query.html"><strong aria-hidden="true">3.4.</strong> fri_query</a></li><li class="chapter-item expanded "><a href="advanced/quotient.html"><strong aria-hidden="true">3.5.</strong> quotient</a></li></ol></li><li class="chapter-item expanded "><a href="code_walkthrough/index.html"><strong aria-hidden="true">4.</strong> Code Walkthough</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="code_walkthrough/prover_walkthrough.html"><strong aria-hidden="true">4.1.</strong> Prover</a></li><li class="chapter-item expanded "><a href="code_walkthrough/verifier_walkthrough.html"><strong aria-hidden="true">4.2.</strong> Verifier</a></li></ol></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
