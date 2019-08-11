`babel-plugin-react-aot`

### **Experimental - Please do not use it in production**

---

## **React - Ahead of Time**

Basically, it's a extremely WIP plugin for Babel to parse **React Components** into **Vanilla Javascript Code**, removing the needed to use the React virtual dom, diff and reconciliation algorithm.

This React Code:

```javascript
function Message() {
  return <p>Hello World</p>;
}

function App() {
  const [show, setShow] = React.useState(false);

  return (
    <div>
      <button onClick={() => setShow(value => !value)}>Show</button>
      <br />
      {show && <Message />}
    </div>
  );
}

ReactDOM.render(<App />, document.querySelector("#app"));
```

Turn into this Vanilla Javascript Code:

```javascript
function Message() {
  let _p1;

  return (_p1 = _createElement("p", null, "Hello World"));
}

function App() {
  const _update = {};

  const [show, setShow] = _useState(() => _update.show)(false);

  let _div1;

  _update.show = show => {
    _div1.children[2].replaceWith(show && _createElement(Message, null));
  };

  return (_div1 = _createElement(
    "div",
    null,
    _createElement(
      "button",
      {
        onClick: () => setShow(value => !value)
      },
      "Show"
    ),
    _createElement("br", null),
    show && _createElement(Message, null)
  ));
}

_render(_createElement(App, null), document.querySelector("#app"));
```

---

### Runtime API

You can see that there are some runtime functions to help with the DOM API and the React Hooks API itself. It will be injected on the generated code when needed.
