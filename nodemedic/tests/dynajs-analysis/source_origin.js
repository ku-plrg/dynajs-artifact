var x = 'secret';
__set_taint__(x);
__assert__(__is_tainted__(x));
__assert__(__is_tainted_at__(x, 0));
