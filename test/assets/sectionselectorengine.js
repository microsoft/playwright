({
  create(root, target) {
  },
  query(root, selector) {
    return root.querySelector('section');
  },
  queryAll(root, selector) {
    return Array.from(root.querySelectorAll('section'));
  }
})