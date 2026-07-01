var x = 'secret';
__set_taint__(x);
__assert__(__taint_loc_line__(x) === 2);
